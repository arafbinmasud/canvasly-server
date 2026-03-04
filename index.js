const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./canvasly-firebase-admin-key.json");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// firebase initialization:
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middlewares
app.use(cors());
app.use(express.json());

// custom middlewares
const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Invalid token" });
  }
};

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
      const sortFields = { created_at: -1 };
      const projectFields = {
        image_url: 1,
        title: 1,
        category: 1,
        user_name: 1,
        likes: 1
      };
      const cursor = artsCollection
        .find()
        .sort(sortFields)
        .project(projectFields)
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/all-artworks", async(req, res) => {
      const {search} = req.query;
      const {category} = req.query;
      const query = {visibility: "Public"}
      if(category && category !== 'All Works'){
        query.category = category;
      }
      if(search){
        query.$or = [
          {title: {$regex: search, $options: 'i'}},
          {user_name: {$regex: search, $options: 'i'}}
        ]
      }
      const cursor = artsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    //post operations:
    app.post("/artworks", verifyFirebaseToken, async (req, res) => {
      const artworkData = req.body;
      const tokenEmail = req.user.email;
      const { user_email } = artworkData;
      if (tokenEmail !== user_email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await artsCollection.insertOne(artworkData);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
