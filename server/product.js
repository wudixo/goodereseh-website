const params = new URLSearchParams(window.location.search);


const productId = params.get("productId");


const artworkTitle =
document.getElementById("artwork-title");

const artworkType =
document.getElementById("artwork-type");

const artworkSize =
document.getElementById("artwork-size");

const artworkPrice =
document.getElementById("artwork-price");


const checkoutButton =
document.getElementById("checkout-button");



/*
Product information

The server controls:
- artwork name
- artwork type
- price

The browser only sends productId.
*/


const productNames = {

    fragments_original:
    "Fragments of Thought Original Artwork",

    fragments_print_A4:
    "Fragments of Thought Fine Art Print A4",

    fragments_print_A3:
    "Fragments of Thought Fine Art Print A3",

    fragments_print_A2:
    "Fragments of Thought Fine Art Print A2",

    fragments_print_A1:
    "Fragments of Thought Fine Art Print A1",


    reflections_original:
    "Reflections Original Artwork",

    reflections_print_A4:
    "Reflections Fine Art Print A4",

    reflections_print_A3:
    "Reflections Fine Art Print A3",

    reflections_print_A2:
    "Reflections Fine Art Print A2",

    reflections_print_A1:
    "Reflections Fine Art Print A1",


    fela_original:
    "Fela Kuti Original Hand Drawn Portrait",

    fela_print_A4:
    "Fela Kuti Fine Art Print A4",

    fela_print_A3:
    "Fela Kuti Fine Art Print A3",

    fela_print_A2:
    "Fela Kuti Fine Art Print A2",

    fela_print_A1:
    "Fela Kuti Fine Art Print A1",


    the_stance_print_A4:
    "The Stance Fine Art Print A4",

    the_stance_print_A3:
    "The Stance Fine Art Print A3",

    the_stance_print_A2:
    "The Stance Fine Art Print A2",

    the_stance_print_A1:
    "The Stance Fine Art Print A1"

};



artworkTitle.innerText =
productNames[productId] || "Artwork";


artworkType.innerText =
"Fine Art Purchase";


artworkSize.innerText =
"Size selected at checkout";


artworkPrice.innerText =
"Price calculated securely at checkout";





checkoutButton.addEventListener(
"click",
async ()=>{


const form =
document.getElementById("purchase-form");


const formData =
new FormData(form);



const order = {


productId:
productId,


name:
formData.get("name"),


email:
formData.get("email"),


phone:
formData.get("phone"),


address:
formData.get("address")

};




console.log(
"Sending order to Stripe:",
order
);





if(
!order.productId ||
!order.name ||
!order.email ||
!order.address
){

alert(
"Artwork and delivery information are required."
);

return;

}





checkoutButton.innerText =
"Processing Payment...";


checkoutButton.disabled =
true;





try{


const response =
await fetch(
"https://goodereseh-website-production.up.railway.app/create-checkout-session",
{


method:
"POST",


headers:
{

"Content-Type":
"application/json"

},


body:
JSON.stringify(order)


}

);





const session =
await response.json();





console.log(
"Stripe response:",
session
);





if(session.url){


window.location.href =
session.url;


}

else{


alert(
"Unable to create payment session."
);


console.error(session);


}





}


catch(error){


console.error(
"Payment Error:",
error
);



alert(
"Payment system unavailable. Please try again."
);



checkoutButton.innerText =
"Proceed To Secure Payment";


checkoutButton.disabled =
false;


}



});