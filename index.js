const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const fileUpload = require("express-fileupload");

const port = process.env.PORT || 5000;

const serviceAccount = require("./jerins-parlour-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1wea1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("jerins-parlour");
    const serviceCollection = database.collection("services");
    const bookedCollection = database.collection("bookedService");
    const userCollection = database.collection("users");
    const reviewCollection = database.collection("reviews");

    //----------get services------------//
    app.get("/services", async (req, res) => {
      const cursor = await serviceCollection.find({}).toArray();
      res.json(cursor);
    });

    //-----------Get Single service Details start---------------//
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.json(result);
    });
    //-----------Get Single service Details end---------------//

    //--------------post ordered data start ----------------------//
    app.post("/bookedService", async (req, res) => {
      const bookedService = req.body;
      const result = await bookedCollection.insertOne(bookedService);
      res.json(result);
    });
    //--------------post ordered data end ----------------------//

    //---------------get booked service by email start  --------------//
    app.get("/bookedService/:email", verifyToken, async (req, res) => {
      const result = await bookedCollection
        .find({ email: req.params.email })
        .toArray();
      res.json(result);
    });
    //---------------get booked service by email end --------------//

    //--------------Delete service by admin start----------------------//
    app.delete("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      console.log(result);
      res.json(result);
    });
    //--------------Delete service by admin end----------------------//

    //---------------get all booked service start --------------//
    app.get("/bookedService", async (req, res) => {
      const result = await bookedCollection.find({}).toArray();
      res.json(result);
    });
    //---------------get booked service end --------------//

    //----------------- status update booked service start -----------------//

    app.put("/bookedService/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Shipped",
        },
      };
      const result = await bookedCollection.updateOne(query, updateDoc);
      res.json(result);
    });
    //----------------- status update booked service end -----------------//

    //-----------------booked service start--------------------//
    app.delete("/bookedService/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookedCollection.deleteOne(query);
      res.json(result);
    });
    //-----------------booked service end--------------------//

    //---------------------get user start---------------------//
    app.get("/users", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.json(result);
    });
    //---------------------get user end---------------------//

    //---------------------get review start---------------------//
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.json(result);
    });
    //---------------------get review end---------------------//

    //-----------------post user to database start-------------------//
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });
    //-----------------post user to database end-------------------//

    //-----------put user to database start-------------------//
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });
    //-----------put user to database end-------------------//

    //--------start review section------------//
    app.post("/reviews", async (req, res) => {
      const name = req.body.name;
      const email = req.body.email;
      const occupation = req.body.occupation;
      const message = req.body.message;
      const rating = req.body.value;
      const pic = req.files.image;
      const picData = pic.data;
      const encodedPic = picData.toString("base64");
      const imageBuffer = Buffer.from(encodedPic, "base64");
      const comment = {
        name,
        email,
        occupation,
        message,
        rating,

        image: imageBuffer,
      };
      const result = await reviewCollection.insertOne(comment);
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        req.status(403).json({ message: "you don not have " });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Jerins Parlour");
});

app.listen(port, () => {
  console.log(`Jerins parlour on port ${port}`);
});
