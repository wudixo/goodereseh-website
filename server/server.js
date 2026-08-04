require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");


const app = express();


const stripe = Stripe(process.env.STRIPE_SECRET_KEY);



app.use(cors());

app.use(express.json());



app.get("/", (req, res) => {

    res.send("Good Ereseh Stripe Server is Running");

});




app.post("/create-checkout-session", async (req, res) => {


    try {


        const {
            artwork,
            price,
            type
        } = req.body;



        const session = await stripe.checkout.sessions.create({


            payment_method_types: [

                "card"

            ],



            line_items: [


                {


                    price_data: {


                        currency: "gbp",



                        product_data: {

                            name: artwork,

                            description:
                            `${type} by Good Ereseh`

                        },


                        unit_amount:
                        Number(price) * 100


                    },


                    quantity: 1


                }


            ],



            mode: "payment",



            success_url:
            "http://127.0.0.1:5500/success.html",



            cancel_url:
            "http://127.0.0.1:5500/purchase/purchase.html"



        });



        res.json({

            url: session.url

        });



    } catch(error) {


        console.log(error);


        res.status(500).json({

            error:error.message

        });


    }


});






app.listen(3000, () => {


    console.log(
        "Good Ereseh Stripe server running on port 3000"
    );


});
