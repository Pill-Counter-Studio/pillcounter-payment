import crypto from "crypto";
import { URLSearchParams } from "url";
import { PeriodPaymentOrder } from "./types";
import settings from "./settings.json";

export function checkSettings(): void {
    try {
        if (Object.keys(settings).length === 0) throw new Error("Empty settings.json");
        Object.entries(settings).forEach(([k, v]) => {
            if (k.length === 0) {
                console.log(k, v)
                throw new Error("Invalid settings.json")
            }
        })
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

export function checkEnvs(): void {
    try {
        // Status
        if (process.env.VERSION === undefined) {
            throw new Error(`Environment variable VERSION is not found.`);
        }
        if (process.env.PORT === undefined) {
            throw new Error(`Environment variable PORT is not found.`);
        }
        if (process.env.NODE_ENV === undefined) {
            throw new Error(`Environment variable NODE_ENV is not found.`);
        }
        // Payment
        if (process.env.MERCHANT_ID === undefined) {
            throw new Error(`Environment variable MERCHANT_ID is not found.`);
        }
        if (process.env.HASHKEY === undefined) {
            throw new Error(`Environment variable HASHKEY is not found.`);
        }
        if (process.env.HASHIV === undefined) {
            throw new Error(`Environment variable HASHIV is not found.`);
        }
        if (process.env.NEWEBPAY_VERSION === undefined) {
            throw new Error(`Environment variable NEWEBPAY_VERSION is not found.`);
        }
        // External APIs
        if (process.env.CLIENT_RETURN_URL === undefined) {
            throw new Error(`Environment variable CLIENT_RETURN_URL is not found.`);
        }
        if (process.env.PAYMENT_SERVER_URL === undefined) {
            throw new Error(`Environment variable PAYMENT_SERVER_URL is not found.`);
        }
        if (process.env.PAYGATEWAY === undefined) {
            throw new Error(`Environment variable PAYGATEWAY is not found.`);
        }
        if (process.env.SERVER_URL === undefined) {
            throw new Error(`Environment variable SERVER_URL is not found.`);
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

function genDataChain(order: PeriodPaymentOrder) {
    let formData = new URLSearchParams();
    Object.entries(order).forEach(([k, v]) => {
        formData.append(k, v);
    })
    return formData.toString();

}

export function createSesEncrypt(object: any) {
    const encrypt = crypto.createCipheriv('aes-256-cbc', process.env.HASHKEY!, process.env.HASHIV!);
    const enc = encrypt.update(genDataChain(object), 'utf8', 'hex');
    return enc + encrypt.final('hex');
}

export function createShaEncrypt(aesEncrypt: string) {
    const sha = crypto.createHash('sha256');
    const plainText = `HashKey=${process.env.HASHKEY}&${aesEncrypt}&HashIV=${process.env.HASHIV}`;

    return sha.update(plainText).digest('hex').toUpperCase();
}

export function createSesDecrypt(TradeInfo: string) {
    const decrypt = crypto.createDecipheriv('aes256', process.env.HASHKEY!, process.env.HASHIV!);
    decrypt.setAutoPadding(false);
    const text = decrypt.update(TradeInfo, 'hex', 'utf8');
    const plainText = text + decrypt.final('utf8');
    const result = plainText.replace(/[\x00-\x20]+/g, '');
    return JSON.parse(result);
}