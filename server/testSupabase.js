require("dotenv").config();

const supabase = require("./supabase");

async function test(){

    const { data, error } = await supabase
        .from("artworks")
        .select("*")
        .limit(5);


    if(error){
        console.error(error);
        return;
    }


    console.log(data);

}

test();
