import fetch from "node-fetch";
import { UserWithOrder } from "./types";


export const orderApi = {
    createOrder: async ({ merchant_order_no, raw_order, user_id }: { merchant_order_no: string, raw_order: any, user_id: string }) => {
        return await fetch(`${process.env.SERVER_URL}/order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                merchant_order_no,
                raw_order,
                user_id
            })
        }).then(res => {
            return res.json();
        }).then(data => {
            console.log(data);
        }).catch(err => {
            console.error(err);
            throw err;
        })
    },
    updateOrder: async ({ merchant_order_no, payment_result, is_success }: { merchant_order_no: string, payment_result: any, is_success: boolean }) => {
        return await fetch(`${process.env.SERVER_URL}/orders/${merchant_order_no}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                payment_result,
                is_success,
            })
        }).then(res => {
            return res.json();
        }).then(data => {
            console.log(data);
        }).catch(err => {
            console.error(err);
            throw err;
        })
    },
    cancelOrder: async ({ merchant_order_no, authHeader }: { merchant_order_no: string, authHeader: string }) => {
        return await fetch(`${process.env.SERVER_URL}/orders/${merchant_order_no}`, {
            method: "DELETE",
            headers: {
                "Authorization": authHeader
            }
        }).then(res => {
            return res.json();
        }).then(data => {
            console.log(data);
        }).catch(err => {
            console.error(err);
            throw err;
        })
    }
}

export const userApi = {
    getUserWithOrders: async ({ authHeader }: { authHeader: string }): Promise<UserWithOrder> => {
        return await fetch(`${process.env.SERVER_URL}/user/order?onlySuccess=true`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
        }).then(res => {
            return res.json();
        }).then(data => {
            // console.log(data);
            return data;
        }).catch(err => {
            console.error(err);
            throw err;
        })
    }
}