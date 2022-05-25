const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m7jtw.mongodb.net/?retryWrites=true&w=majority`;

// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        console.log('Database connected');
        const serviceCollection = client.db('parts_manufacturer').collection('product');
        const placeOrderCollection = client.db('parts_manufacturer').collection('placeOrder');
        const userCollection = client.db('parts_manufacturer').collection('users');


        // get all
        app.get('/part', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        // get one
        app.get('/part/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const part = await serviceCollection.findOne(query);
            res.send(part);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })



        app.post("/placeOrder", async (req, res) => {
            const placeOrder = req.body;
            const result = await placeOrderCollection.insertOne(placeOrder);
            res.send(result);
        });

        app.get("/placeOrder", async (req, res) => {
            const customerEmail = req.query.email;
            console.log(customerEmail);
            const query = { customerEmail: customerEmail };
            const placeOrder = req.body;
            const orders = await placeOrderCollection.find(query).toArray();
            res.send(orders);
        });



    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Bike Manufacture!')
})

app.listen(port, () => {
    console.log(`Bike Manufacture app listening on port ${port}`)
})