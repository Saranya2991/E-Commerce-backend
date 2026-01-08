const express = require("express")
const cors = require("cors")
require("dotenv").config();

const app = express()

app.use(cors())
app.use(express.json())

const mongoose = require("mongoose")
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB not connected"));

  const productSchema = mongoose.Schema(
  {
    image: { type: String, required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true },
  }
);

const Product = mongoose.model("Product", productSchema, "product");


const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      title: String,
      price: Number,
      image: String,
      quantity: { type: Number, default: 1 }
    }
  ]
});
const Cart = mongoose.model("Cart", cartSchema, "cart");


app.get("/",(req,res)=>{
    res.send("Server is Running")
    console.log(res)
})


app.get("/product", async (req, res) => {
  try {
    const products = await Product.find();
    res.send(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


//Get user cart

app.get("/api/cart/:userId", async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) {
      cart = await Cart.create({ userId: req.params.userId, items: [] });
    }
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// Add to cart
app.post("/api/cart/add", async (req, res) => {
  const { userId, product } = req.body;
  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === product._id
    );
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.items.push({
        productId: product._id,
        title: product.title,
        price: product.price,
        image: product.image,
        quantity: 1
      });
    }
    await cart.save();
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


//update quantity

app.put("/api/cart/update", async (req, res) => {
  const { userId, productId, action } = req.body;

  const cart = await Cart.findOne({ userId });
  if (!cart) return res.json({ items: [] });

  const item = cart.items.find(
    (i) => i.productId.toString() === productId
  );

  if (!item) return res.json(cart);

  if (action === "increase") item.quantity += 1;
  if (action === "decrease") {
    item.quantity -= 1;
    if (item.quantity <= 0) {
      cart.items = cart.items.filter(
        (i) => i.productId.toString() !== productId
         );
    }
  }

  await cart.save();
  res.json(cart);
});

// Remove from cart
app.delete("/api/cart/remove/:userId/:productId", async (req, res) => {
  const { userId, productId } = req.params;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.json({ items: [] });
    }

    // SAFE FILTER (no ObjectId methods)
    cart.items = cart.items.filter(
      (item) =>
        item.productId &&
        item.productId.toString() !== productId
    );

    await cart.save();

    res.json({ items: cart.items });
  } catch (err) {
    console.error("REMOVE CART ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      title: String,
      price: Number,
      quantity: Number
    }
  ],
  total: { type: Number, required: true },
  address: {
    name: String,
    address: String,
    phone: String
  },
  status: { type: String, default: "Placed" },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", orderSchema, "orders");

app.post("/api/orders", async (req, res) => {
  try {
    const { userId, items, total, address } = req.body;

    if (!userId || !items.length || !address) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const order = await Order.create({
      userId,
      items,
      total,
      address,
    });

    // Clear cart after order
    await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } }
    );

    res.status(201).json(order);
  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


app.listen(PORT,()=>{
    console.log(`Server Running on Port ${PORT}`)
})