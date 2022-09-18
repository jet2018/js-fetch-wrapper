import Jet from "./jet.mjs";

const jet = new Jet("https://africantalks.herokuapp.com/api/")

jet.get("blog/articles").then(res => console.log(res.data))