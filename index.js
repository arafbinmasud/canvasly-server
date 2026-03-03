const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require('cors')
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors())
app.use(express.json()) 

app.get("/", (req, res) => {
  res.send("Server is running...");
});

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
    deprecationErrors: true,
  },
});

// mongodb function
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("connected to mongodb");
    const db = client.db("canvasly-db");
    const artsCollection = db.collection("artworks");


    //get operations:
    app.get("/featured-artworks", async (req, res) => {
        const sortFields = { created_at: -1}
        const projectFields = {image_url: 1, title: 1, category: 1, user_name: 1}
        const cursor = artsCollection.find().sort(sortFields).project(projectFields).limit(6);
        const result = await cursor.toArray();
        res.send(result)
    })

    //post operations:
    app.post("/artworks", async(req, res) => {
        const artworkData = req.body;
        const result = await artsCollection.insertOne(artworkData)
        res.send(result)
    })



  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
