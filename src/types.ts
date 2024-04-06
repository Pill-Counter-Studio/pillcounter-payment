export interface PeriodPaymentOrder {
    RespondType: "JSON" | "String"
    TimeStamp: number
    Version: "1.5"
    LangType?: "en" | "zh-Tw"  // Default to zh-Tw
    MerOrderNo: string  // Merchant order no
    ProdDesc: string   // Product Description
    PeriodAmt: number  // $TWD
    PeriodType: "M" | "D" | "W" | "Y"
    PeriodPoint: string  // [D]2-999, [W]1-7, [M]1-31, [Y]"MMDD"
    PeriodStartType: 1 | 2 | 3  // 1:立即執行十元授權, 2:立即執行委託金額授權, 3:不檢查信用卡資訊，不授權
    PeriodTimes: number
    PeriodFirstdate?: string   // 本欄位只有 PeriodType=D 及 PeriodStartType=3 時有效
    ReturnURL?: string   // 返回商店網址, 若此欄位為空值，交易完成後，付款人將停留在藍新金流交易完成頁面
    PeriodMemo?: string
    PayerEmail: string
    EmailModify?: 1 | 2  // 1:可修改, 2:不可修改
    PaymentInfo?: "Y" | "N"  // 是否開啟付款人資訊
    OrderInfo?: "Y" | "N"  // 是否開啟收件人資訊
    NotifyURL?: string   // 每期授權結果通知網址，若此欄位為空值，則不通知商店授權結果
    BackURL?: string  // 取消交易時返回商店的網址
    UNIONPAY?: 1 | 0   // 設定是否啟用銀聯卡支付方式
}

export interface UnSubscribePayload {
    RespondType: "JSON" | "String"
    TimeStamp: number
    Version: "1.0"
    MerOrderNo: string  // Merchant order no
    PeriodNo: string  // Period no
    AlterType: "terminate"
}

export interface JwtPayload {
    userId: string
    username: string
    email: string
    locale: string
    avatar_uri: string
}

export interface UserWithOrder {
    id: string
    email: string
    free_tried_count: number
    is_paid: boolean
    created_at: string
    updated_at: string
    username: string
    avatar_uri: string
    available_predict_count: number
    is_deleted: boolean
    orders: {
        raw_order: { [key: string]: string }
        merchant_order_no: string
        period_no: string
        is_canceled: boolean
        is_deleted: boolean
        created_at: string
        user_id: string
        id: string
        payment_results: {
            Status: string
            Message: string
            Result: {
                MerchantID: string
                MerchantOrderNo: string
                PeriodType: "M" | "Y" | "D" | "D"
                AuthTimes: string
                DateArray: string
                PeriodAmt: string
                PeriodNo: string
                TradeNo: string
                AuthCode: string
                RespondCode: string
                AuthTime: string
                CardNo: string
                EscrowBank: string
                AuthBank: string
                PaymentMethod: string
            }
        }
    }[]
}