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

    lion_original:
    "Lion",

    freedom_original:
    "Freedom",

    hope_original:
    "Hope"

};



artworkTitle.innerText =
productNames[productId] || "Artwork";


artworkType.innerText =
"Original Artwork";


artworkSize.innerText =
"Artwork Purchase";


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