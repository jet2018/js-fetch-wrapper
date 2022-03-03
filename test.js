import { Jet } from './modules/main.js';

jet = new Jet('https://nonix.herokuapp.com/api/v1/');

jet.get("hotels")
    .then(function(data) {
        console.log(data);
    })
    .catch(function(err) {
        console.log(err);
    });