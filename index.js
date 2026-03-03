const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()



const app = express();
const port = process.env.PORT || 5000;


app.get("/", (req, res) => {
    res.send("Server is running...")
})

// mongodb uri 
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
console.log(user, password);

const uri = `mongodb+srv://${user}:${password}@cluster0.ci4q50w.mongodb.net/?appName=Cluster0`;

//mongo client 
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});


// mongodb function 
async function run() {
    try {
        await client.connect();
        await client.db('admin').command({ping:1});
        console.log('connected to mongodb');
        
    }
    finally{

    }
}
run().catch(console.dir);




app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    
})