require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { Resend } = require("resend");

const app = express();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);



async function sendOrderEmails(order) {

    try {

        await resend.emails.send({

            from: "Good Ereseh <art@goodereseh.com>",

            to: process.env.OWNER_EMAIL,

            subject: "New Artwork Order | Good Ereseh",

            html: `

            <h2>New Artwork Order Received</h2>

            <p><strong>Artwork:</strong> ${order.artwork}</p>

            <p><strong>Customer:</strong> ${order.name}</p>

            <p><strong>Email:</strong> ${order.email}</p>

            <p><strong>Phone:</strong> ${order.phone}</p>

            <p><strong>Address:</strong> ${order.address}</p>

            <p><strong>Amount:</strong> £${order.price}</p>

            `

        });



        await resend.emails.send({

            from: "Good Ereseh <art@goodereseh.com>",

            to: order.email,

            subject: "Thank you for your artwork purchase | Good Ereseh",

            html: `

            <h2>Thank you for your purchase</h2>

            <p>Dear ${order.name},</p>

            <p>Your payment has been received successfully.</p>

            <p><strong>Artwork:</strong> ${order.artwork}</p>

            <p><strong>Amount:</strong> £${order.price}</p>

            <p>We will contact you shortly regarding delivery.</p>

            <p>Thank you for supporting original art.</p>

            <p>Good Ereseh</p>

            `

        });


        console.log("Order emails sent successfully");


    } catch(error) {

        console.log("Email error:", error);

    }

}





/*
Stripe Webhook
Must come before express.json()
*/

app.post(
    "/webhook",
    express.raw({type:"application/json"}),
    async (req,res)=>{


        const signature = req.headers["stripe-signature"];

        let event;


        try {


            event = stripe.webhooks.constructEvent(

                req.body,

                signature,

                process.env.STRIPE_WEBHOOK_SECRET

            );


        } catch(error){


            console.log(
                "Webhook signature failed:",
                error.message
            );


            return res.status(400).send(
                `Webhook Error: ${error.message}`
            );

        }



        if(event.type === "checkout.session.completed"){


            const session = event.data.object;


            const order = {


                artwork:
                session.metadata.artwork,


                price:
                session.metadata.price,


                name:
                session.metadata.name ||
                session.customer_details?.name ||
                "Customer",


                email:
                session.metadata.email ||
                session.customer_details?.email,


                phone:
                session.metadata.phone ||
                session.customer_details?.phone ||
                "Not provided",


                address:
                session.metadata.address ||
                session.customer_details?.address?.line1 ||
                "Not provided"


            };



            await sendOrderEmails(order);


        }



        res.json({

            received:true

        });


    }
);





app.use(cors());

app.use(express.json());





app.get("/", (req,res)=>{


    res.send(
        "Good Ereseh Stripe Server is Running"
    );


});







app.post("/create-checkout-session", async(req,res)=>{


    try {


        const {

            artwork,
            price,
            type,
            name,
            email,
            phone,
            address

        } = req.body;





        const session = await stripe.checkout.sessions.create({



            payment_method_types:["card"],



            line_items:[

                {

                    price_data:{


                        currency:"gbp",


                        product_data:{


                            name: artwork,


                            description:
                            `${type} by Good Ereseh`


                        },


                        unit_amount:
                        Number(price) * 100


                    },


                    quantity:1

                }

            ],




            mode:"payment",



            customer_email: email,



            billing_address_collection:"required",



            phone_number_collection:{

                enabled:true

            },



            metadata:{


                artwork,

                price,

                name,

                email,

                phone,

                address


            },



            success_url:
            "https://goodereseh.com/success.html",



            cancel_url:
            "https://goodereseh.com/cancel.html"



        });





        res.json({

            url:session.url

        });




    } catch(error){


        console.log(error);



        res.status(500).json({

            error:error.message

        });


    }


});








app.listen(3000,()=>{


    console.log(
        "Good Ereseh Stripe server running on port 3000"
    );


});