const params = new URLSearchParams(window.location.search);


const artwork = params.get("artwork");
const product = params.get("product");
const size = params.get("size");
const price = params.get("price");
const title = params.get("title");



const artworkTitle = document.getElementById("artwork-title");
const artworkType = document.getElementById("artwork-type");
const artworkSize = document.getElementById("artwork-size");
const artworkPrice = document.getElementById("artwork-price");



const checkoutButton = document.getElementById("checkout-button");



artworkTitle.innerText =
title || artwork || "Artwork";



artworkType.innerText =
product === "print"
?
"Limited Edition Fine Art Print"
:
"Original Artwork";



if(size){

artworkSize.innerText =
"Print Size: " + size;

}
else{

artworkSize.innerText =
"Original Artwork";

}



if(price){

artworkPrice.innerText =
"£" + Number(price).toLocaleString();

}
else{

artworkPrice.innerText =
"Price unavailable";

}





checkoutButton.addEventListener("click", async ()=>{



const customerName =
document.querySelector('input[name="name"]').value.trim();



const customerEmail =
document.querySelector('input[name="email"]').value.trim();



const customerAddress =
document.querySelector('textarea[name="address"]').value.trim();





if(!customerName || !customerEmail || !customerAddress){

alert(
"Please complete your delivery information before continuing."
);

return;

}





if(!title || !price){

alert(
"Artwork information is missing. Please return to the artwork page and try again."
);

return;

}





checkoutButton.innerText =
"Processing Payment...";



checkoutButton.disabled = true;





const order = {


artwork:
title || artwork,



price:
price,



type:

product === "print"

?

`${size} Fine Art Print`

:

"Original Artwork"



};







try{



const response = await fetch(

"http://localhost:3000/create-checkout-session",

{


method:"POST",


headers:{


"Content-Type":"application/json"

},


body:JSON.stringify(order)


}

);





const session =
await response.json();





if(session.url){


window.location.href = session.url;


}

else{


console.error(session);
alert("Unable to create payment session."
);


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



checkoutButton.disabled = false;



}



});