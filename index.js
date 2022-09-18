import Jet from "./jet.js";

const jet = new Jet("https://africantalks.herokuapp.com/api/")

jet.get("blog/articles").then(res => console.log(res.data))