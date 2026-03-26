import mongoose from "mongoose";
import app from "./app";

mongoose
  .connect("mongodb://127.0.0.1:27017/vi-notes")
  .then(() => {
    console.log("MongoDB connected");
    app.listen(5000, () => console.log("Server running on port 5000"));
  })
  .catch((err) => console.log(err));