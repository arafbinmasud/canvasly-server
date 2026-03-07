const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const favoritesCollection = db.collection("favorite_artworks");
    const usersCollection = db.collection("users");

    //get operations:
    app.get("/featured-artworks", async (req, res) => {
      const sortFields = { created_at: -1 };
      const projectFields = {
        image_url: 1,
        title: 1,
        category: 1,
        artist_name: 1,
        likes: 1,
      };
      const cursor = artsCollection
        .find()
        .sort(sortFields)
        .project(projectFields)
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/all-artworks", async (req, res) => {
      const { search } = req.query;
      const { category } = req.query;
      const query = { visibility: "Public" };
      if (category && category !== "All Works") {
        query.category = category;
      }
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { user_name: { $regex: search, $options: "i" } },
        ];
      }
      const cursor = artsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/artwork/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artsCollection.findOne(query);
      res.send(result);
    });

    app.get("/artworks-count/:email", async (req, res) => {
      const { email } = req.params;
      const query = { artist_email: email };
      const result = await artsCollection.countDocuments(query);
      res.send(result);
    });

    app.get("/my-artworks", verifyFirebaseToken, async (req, res) => {
      const { email } = req.query;
      const tokenEmail = req.user.email;
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { artist_email: email };
      const sortedField = { created_at: -1 };
      const cursor = artsCollection.find(query).sort(sortedField);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/my-favorites", verifyFirebaseToken, async (req, res) => {
      const { email } = req.query;
      const tokenEmail = req.user.email;

      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      //step 1: favorites colllection theika user er sob docs aina array banamu
      const favoriteArts = await favoritesCollection
        .find({ user_email: email })
        .sort({ added_at: -1 })
        .toArray();

      //step 2: jodi kono favorite na thake taile ekta khali array frontend a pathay dimu..
      if (favoriteArts.length === 0) {
        return res.send([]);
      }

      //step 3: user er favorite arts er array te map chalaiya arekta array banamu jekhane favorite list er artwork_id k mongodb er objectId te convert kormu ar ki..
      const favoriteArtIds = favoriteArts.map(
        (art) => new ObjectId(art.artwork_id),
      );

      //step 4: ekhoon ei j array ta pailam objectid er, eta diye main artscollection a query chalaiya jei jei docs er _id er sathe ei array er id gula mile segula ber korbo, er jonno $in lagbe , array diye query korte

      const fetchedArts = await artsCollection
        .find({ _id: { $in: favoriteArtIds } })
        .toArray();

      //step 5: sorting--> ekhon favoritedArtIds jeta kina sorted array sei array er reference a ei fetchedArts array ta sajay nibo:

      const result = favoriteArtIds
        .map((id) =>
          fetchedArts.find((art) => art._id.toString() === id.toString()),
        )
        .filter((art) => art !== undefined); //jate artist kono art delete koira dile undefined na ashe

      res.send(result);
    });

    app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
      const { email } = req.params;
      const tokenEmail = req.user.email;
      if (email !== tokenEmail) {
        res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    //post operations:
    app.post("/artworks", verifyFirebaseToken, async (req, res) => {
      const artworkData = req.body;
      const tokenEmail = req.user.email;
      const { artist_email } = artworkData;

      if (tokenEmail !== artist_email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await artsCollection.insertOne(artworkData);
      res.send(result);
    });

    app.post("/favorites", verifyFirebaseToken, async (req, res) => {
      const favoriteData = req.body;
      const user_email = favoriteData.user_email;
      const tokenEmail = req.user.email;
      if (user_email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = {
        artwork_id: favoriteData.artwork_id,
        user_email: favoriteData.user_email,
      };
      const existingDoc = await favoritesCollection.findOne(query);
      if (existingDoc) {
        return res.status(400).send({ message: "Already in favorites" });
      }
      const result = await favoritesCollection.insertOne(favoriteData);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User Already Exists" });
      }
      const newUser = {
        ...user,
        bio: "Love to play with colors and abstract shapes. Creating art is my meditation.",
      };
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    //patch operations:
    app.patch("/likes-count/:id", verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      const { user_email } = req.body;
      const tokenEmail = req.user.email;
      if (user_email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { likes: 1 } };
      const result = await artsCollection.updateOne(query, update);
      res.send(result);
    });

    app.patch("/users/update-bio", verifyFirebaseToken, async (req, res) => {
      const {email, bio} = req.body;
      
      const tokenEmail = req.user.email;
      if (email !== tokenEmail) {
        res.status(403).send({ message: "forbidden access" });
      }
      const query = {email: email}
      const updateDoc = { 
        $set: {
          bio: bio
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result);
    });

    //delete operations:
    app.delete("/all-artworks/:id", verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      const tokenEmail = req.user.email;

      const query = { _id: new ObjectId(id), artist_email: tokenEmail };
      const result = await artsCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/favorites/:id", verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      const tokenEmail = req.user.email;
      const query = { artwork_id: id, user_email: tokenEmail };
      const result = await favoritesCollection.deleteOne(query);
      res.send(result);
    });

    //put operations
    app.put("/update-art/:id", verifyFirebaseToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const { id } = req.params;
      const updatedData = req.body;
      const query = { _id: new ObjectId(id), artist_email: tokenEmail };
      const updateDoc = {
        $set: { ...updatedData },
      };
      const result = await artsCollection.updateOne(query, updateDoc);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
