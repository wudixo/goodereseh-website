const express = require("express");

const router = express.Router();

const products = require("../productCatalog");


module.exports = function(stripe) {


router.post(
    "/create-checkout-session",
    async(req,res)=>{


        try {


            const {

                productId,

                name,

                email,

                phone,

                address

            } = req.body;



            const product = products[productId];



            if(!product){

                return res.status(400).json({

                    error:"Invalid artwork selected."

                });

            }



            const session = await stripe.checkout.sessions.create({



                mode:"payment",



                customer_email: email,



                billing_address_collection:"required",



                phone_number_collection:{

                    enabled:true

                },



                line_items:[

                    {

 price_data:{

    currency:"gbp",

    product_data:{
        name: product.artwork,
        description: product.type,
        images:[
            product.image
        ]
    },

    unit_amount:
        product.price * 100

},


                        quantity:1

                    }

                ],



                metadata:{


                    productId,


                    artwork:product.artwork,


                    type:product.type,


                    price:String(product.price),


                    name,


                    email,


                    phone,


                    address:String(address || "")


                },



                success_url:

                "https://goodereseh.com/success.html",



                cancel_url:

                "https://goodereseh.com/cancel.html"


            });



            res.json({

                url:session.url

            });



        }

        catch(error){


            console.error(
                "Checkout error:",
                error
            );


            res.status(500).json({

                error:error.message

            });


        }


    }

);


return router;


};