const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m7jtw.mongodb.net/?retryWrites=true&w=majority`;

// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    console.log('abc');
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        console.log('Database connected');
        const serviceCollection = client.db('parts_manufacturer').collection('product');
        const placeOrderCollection = client.db('parts_manufacturer').collection('placeOrder');
        const userCollection = client.db('parts_manufacturer').collection('users');
        const reviewCollection = client.db('parts_manufacturer').collection('reviews');
        const paymentCollection = client.db('parts_manufacturer').collection('payments');


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

        // find
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

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

        // get all order with jst token
        app.get("/placeOrder", verifyJWT, async (req, res) => {
            const customerEmail = req.query.email;
            // console.log(customerEmail);
            const decodedEmail = req.decoded.email;
            if (decodedEmail === customerEmail) {
                const query = { customerEmail: customerEmail };
                const orders = await placeOrderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        });

        // get all order
        app.post("/placeOrder", async (req, res) => {
            const placeOrder = req.body;
            const result = await placeOrderCollection.insertOne(placeOrder);
            res.send(result);
        });

        // post all part
        app.post("/product", async (req, res) => {
            const product = req.body;
            const result = await serviceCollection.insertOne(product);
            res.send(result);
        });

        // get all order
        app.get('/placeOrder', async (req, res) => {
            const query = {};
            const cursor = placeOrderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        // get orders
        app.get('/orders', async (req, res) => {
            const query = {}
            const cursor = placeOrderCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        // delete order 
        app.delete('/placeOrder/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await placeOrderCollection.deleteOne(query)
            res.send(result)
        })

        // get specific order
        app.get('/placeOrder/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const orders = await placeOrderCollection.findOne(query)
            res.send(orders);
        })

        // delete user
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // get user info
        app.get('/userinfo/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        })

        // delete a product
        app.delete('/part/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await serviceCollection.deleteOne(query)
            res.send(result);
        })


        // get all review
        app.get('/review', async (req, res) => {
            const query = {};
            const reviews = await reviewCollection.find(query).toArray();
            res.send(reviews);

        });

        // add a review | Post review
        app.post("/review", async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        app.patch("/placeOrder/:id",  async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                },
            };
            const updatedOrder = await placeOrderCollection.updateOne(filter, updateDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updateDoc);
        });

        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.placePrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({ clientSecret: paymentIntent.client_secret });
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