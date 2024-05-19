import express, { Express, NextFunction, Response, Request } from "express"
import cors from "cors";
import { checkEnvs, checkSettings, createSesDecrypt, createSesEncrypt, createShaEncrypt } from "./utils";
import { JwtPayload, PeriodPaymentOrder, UnSubscribePayload } from "./types";
import jwt from "jsonwebtoken";
import settings from "./settings.json";
import { orderApi, userApi } from "./apis";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import morgan from "morgan";

require('dotenv').config();

checkEnvs();
checkSettings();

const app: Express = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors({ credentials: true, origin: ['http://localhost:3001'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

fs.mkdir(`${__dirname}/log`, { recursive: true }, (err) => {
    if (err) throw err;
});
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'log', 'payment-service.log'), { flags: 'a' });
app.use(morgan('common', { stream: accessLogStream }));

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
}

app.use(errorHandler);

app.get("/", (req, res, next) => {
    try {
        res.status(200).json({
            app: "Payment Service",
            version: process.env.VERSION
        })
    } catch (err) {
        next(err)
    }
})

app.get("/health", (req, res, next) => {
    try {
        res.status(200).json({
            message: "Payment service is alive"
        })
    } catch (err) {
        next(err);
    }
})

app.get("/settings", (req, res, next) => {
    try {
        res.status(200).json(settings)
    } catch (err) {
        next(err);
    }
})

// Web will call it to place an order
app.post('/order', async (req, res) => {
    try {
        if (!req.headers.authorization || req.headers.authorization.length === 0) {
            return res.status(401).json({
                message: "Invalid token"
            })
        }

        const userPayload = jwt.decode(req.headers.authorization.replace("Bearer", "").trim()) as JwtPayload;
        if (userPayload === null) {
            return res.status(403).json({
                message: "Forbidden"
            })
        }

        const timeStamp = Date.now();
        const MerOrderNo = `order_${timeStamp}`;
        const order: PeriodPaymentOrder = {
            RespondType: "JSON",
            TimeStamp: timeStamp,
            Version: "1.5",
            LangType: "zh-Tw",
            MerOrderNo,
            ProdDesc: settings.productDesc,
            PeriodType: settings.periodType as PeriodPaymentOrder["PeriodType"],
            PeriodAmt: settings.periodAmt,
            PeriodPoint: settings.periodPoint,
            PeriodStartType: settings.periodStartType as PeriodPaymentOrder["PeriodStartType"],
            PeriodTimes: settings.periodTimes,
            OrderInfo: settings.withOrderInfo ? "Y" : "N",
            PaymentInfo: settings.withPaymentInfo ? "Y" : "N",
            PayerEmail: userPayload.email,
            EmailModify: settings.canModifyEmail ? 1 : 2,
            NotifyURL: `${process.env.PAYMENT_SERVER_URL}/newebpay_notify`,
            ReturnURL: `${process.env.PAYMENT_SERVER_URL}/newebpay_return`
        };
        console.log("order", order)

        const aesEncrypt = createSesEncrypt(order);
        console.log('aesEncrypt:', aesEncrypt);

        await orderApi.createOrder({
            merchant_order_no: MerOrderNo,
            raw_order: order,
            user_id: userPayload.userId
        })

        res.status(200).json({
            PayGatewayUrl: process.env.PAYGATEWAY,
            MerchantID: process.env.MERCHANT_ID,
            PostData: aesEncrypt
        })
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
});

// Web will call it to unsubscribe
app.post("/unsubscribe", async (req, res) => {
    try {
        if (!req.headers.authorization || req.headers.authorization.length === 0) {
            return res.status(401).json({
                message: "Invalid token"
            })
        }

        const userPayload = jwt.decode(req.headers.authorization.replace("Bearer", "").trim()) as JwtPayload;
        if (userPayload === null) {
            return res.status(403).json({
                message: "Forbidden"
            })
        }

        const userWithOrder = await userApi.getUserWithOrders({
            authHeader: req.headers.authorization
        });
        if (!userWithOrder) {
            return res.status(400).json({
                message: `Cannot find user ${userPayload.userId} with its order`
            });
        }
        if (userWithOrder.orders.length === 0) {
            return res.status(400).json({
                message: `Found empty order from user id ${userPayload.userId}`
            });
        }
        const userLatestSuccessOrder = userWithOrder.orders[0];
        const timeStamp = Date.now();
        const payload: UnSubscribePayload = {
            RespondType: "JSON",
            TimeStamp: timeStamp,
            Version: "1.0",
            MerOrderNo: userLatestSuccessOrder.merchant_order_no,
            PeriodNo: userLatestSuccessOrder.period_no,
            AlterType: "terminate"
        };
        console.log("Unsubscribe payload", payload)

        const aesEncrypt = createSesEncrypt(payload);
        console.log('aesEncrypt:', aesEncrypt);

        const formData = new URLSearchParams();
        formData.append("MerchantID_", process.env.MERCHANT_ID!);
        formData.append("PostData_", aesEncrypt);
        const response = await fetch(`${process.env.PAYGATEWAY}/AlterStatus`, {
            method: "POST",
            body: formData
        }).then(res => res.json())
        const result = createSesDecrypt(response.period);
        console.log('UnSubscribe result:', result);
        /**
         {
            "Status": "SUCCESS", 
            "Message": "該定期定額委託單暫停成功", 
            "Result": {
                "MerOrderNo": "myorder1700033460", 
                "PeriodNo": "P231115153213aMDNWZ", 
                "AlterType": "suspend"
            }
         }
        */
        if (result.Status === "SUCCESS") {
            orderApi.cancelOrder({
                merchant_order_no: userLatestSuccessOrder.merchant_order_no,
                authHeader: req.headers.authorization
            })
            return res.status(200).json({
                message: "Unsubscribe successful"
            })
        } else {
            return res.status(422).json({
                message: "Unsubscribe failed"
            })
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
})


app.get("/payment/failed", (req, res) => {
    res.render("payment-result", {
        title: "付款失敗",
        description: "因金流服務異常導致付款失敗，請儘速洽詢管理員並提供詳細資訊以利排查，造成您的不便，非常抱歉！",
        href: process.env.CLIENT_RETURN_URL!
    })
})

app.get("/payment/success", (req, res) => {
    res.render("payment-result", {
        title: "付款成功",
        description: "付款已經成功！請點擊返回按鈕",
        href: process.env.CLIENT_RETURN_URL!
    })
})

// NewebPay will call it
// If using period payment, only received this message at the first time
app.post("/newebpay_return", async (req, res) => {
    try {
        console.log("Received NewebPay's returned message: ", req.body);
        const response = req.body;

        if (!response || Object.keys(response).length === 0) throw new Error("Empty response")

        const payment_result = createSesDecrypt(response.Period);
        console.log('Return result:', payment_result);

        if (!payment_result?.Result?.MerchantOrderNo || !payment_result?.Status || !payment_result?.Result) throw new Error("Invalid payment result");

        /**
            payment_result: {
                Status: 'SUCCESS',
                Message: '委託單成立，且首次授權成功(00)',
                Result: {
                    MerchantID: 'MS151500175',  // 藍新金流商店代號
                    MerchantOrderNo: 'order_1709223492849',  // 商店自訂訂單編號
                    PeriodType: 'M',            // 委託週期
                    AuthTimes: '12',            // 此委託總授權期數
                    DateArray: '2024-03-01,2024-04-01,2024-05-01,2024-06-01,2024-07-01,2024-08-01,2024-09-01,2024-10-01,2024-11-01,2024-12-01,2025-01-01,2025-02-01',  // 顯示委託所有授權日期排程
                    PeriodAmt: '100',           // 委託每期金額
                    PeriodNo: 'P24030100183444lssu',  // 委託單號
                    TradeNo: '24030100183423041',  // 藍新金流交易序號
                    AuthCode: '223514',          // 銀行回覆當下該筆交易之授權碼
                    RespondCode: '00',           // 銀行回應碼 00 代表刷卡成功，其餘為刷卡失敗
                    AuthTime: '20240301001834',  // 每期授權時間
                    CardNo: '400022******1111',  // 卡號前六與後四碼
                    EscrowBank: 'HNCB',          // 該筆交易款項保管銀行，HNCB:華南銀行
                    AuthBank: 'Taishin',         // 該筆交易的收單機構
                    PaymentMethod: 'CREDIT'      // CREDIT=台灣發卡機構核發之信用卡，UNIONPAY=銀聯卡
                }
            } 
         */

        if (payment_result.Status !== "SUCCESS") throw new Error("Status not success");

        await orderApi.updateOrder({
            merchant_order_no: payment_result.Result.MerchantOrderNo,
            payment_result,
            is_success: payment_result.Status === "SUCCESS"
        })

        console.log(`Payment Complete, merchant order no: ${payment_result.Result.MerchantOrderNo}`);

        res.redirect(`${process.env.PAYMENT_SERVER_URL}/payment/success`);  // Only the first time needs to redirect user
    } catch (err) {
        console.error(err);
        return res.redirect(`${process.env.PAYMENT_SERVER_URL}/payment/failed`);
    }
})

// NewebPay will call it
app.post("/newebpay_notify", async (req, res) => {
    try {
        console.log("Received NewebPay's notified message: ", req.body);
        const response = req.body;

        if (response && Object.keys(response).length > 0) {
            const payment_result = createSesDecrypt(response.Period);
            console.log('Notify result:', payment_result);

            if (!payment_result?.Result?.MerchantOrderNo || !payment_result?.Status || !payment_result?.Result) throw new Error("Invalid payment result");

            /**
                payment_result: {
                    Status: 'SUCCESS',
                    Message: '授權成功',
                    Result: {
                        MerchantID: 'MS151500175',  // 藍新金流商店代號
                        MerchantOrderNo: 'order_1709223492849',  // 商店自訂訂單編號
                        OrderNo: '???'              // 商店訂單編號_期數
                        PeriodNo: 'P24030100183444lssu',  // 委託單號
                        TradeNo: '24030100183423041',  // 藍新金流交易序號
                        AuthCode: '223514',          // 銀行回覆當下該筆交易之授權碼
                        RespondCode: '00',           // 銀行回應碼 00 代表刷卡成功，其餘為刷卡失敗
                        AuthDate: '???',             // 委託之本期授權時間(Y-m-d h:i:s)
                        TotalTimes: "12"             // 委託之總授權期數
                        EscrowBank: 'HNCB',          // 該筆交易款項保管銀行，HNCB:華南銀行
                        AuthBank: 'Taishin',         // 該筆交易的收單機構
                        AlreadyTimes: "???",         // 委託之已授權期數，包含授權失敗期數
                        AuthAmt: "???",              // 委託單本期授權金額
                        NextAuthDate: "???",         // 下期委託授權日期(Y-m-d) 授權當期若為最後一期，則回覆該期日期
                    }
                } 
            */

            if (payment_result.Status !== "SUCCESS") throw new Error("Status not success");

            await orderApi.updateOrder({
                merchant_order_no: payment_result.Result.MerchantOrderNo,
                payment_result,
                is_success: payment_result.Status === "SUCCESS"
            })

            console.log(`Payment Complete, merchant order no: ${payment_result.Result.MerchantOrderNo}`);
            return res.status(200).json({
                message: "Successfully get the norified message and update order well"
            })
        }

        return res.end();  // The req.body will be empty at the first payment created time

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "Internal Server Error"
        })
    }
})


const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server is running at ${PORT}`));