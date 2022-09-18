## About jet-fetch library

jet-fetch provides a wrapper class for the [fetch]("https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch"). It can be somehow tricky to use fetch API especially for a beginner. However, this library provides a simple way to use fetch API. The package is fully customizable using its `custom` method that enables you customize the whole API

The package ships with the five commonly used http methods but has room for expansion. It covers:-

```
GET
POST
PUT
DELETE
PATCH
```

The supported also seem to be the commonly used methods.

The plugin is totally customizable and therefore can be simple to play with.

With a good knowledge of the fetch API, you can easily implement your own fashion of the library.

## Installation

With npm, simply run 
```bash
npm i jet-fetch
```
or with yarn
```bash 
yarn add jet-fetch
```

## _Defaults_

The library provides various defaults out of the box. All of which can also be overwritten.

Examples.

1. The library by default will allow `cors` if you do not manually set them.
   This can be overriden by setting `cors` to `true` and then defining your custom `Access-Control-Allow-Origin` which will also default to `*`.
2. Defaults to returning the response as a `JSON` object.

```JS
response  = {
    'response': response,
    'data': resData
}
```

On `response`, that's where you can find the `response` object. such as `status`, `statusText`, `headers`, `ok`, `redirected`, `type`, `url`, `body`, `bodyUsed`.

Whereas on `data`, that's where you can find the `data` object. which represents the actual data from the server.

`baseUrl` can be defined while instatiating the Jet class, this will be the base url for all the requests.

## _Usage_

```js
import Jet from 'jet-fetch'


let jet = new Jet(baseUrl="" // optional
));

// body refers to the body of the request
// data refers to the request configuration
// url refers to the url of the request, can be a relative url or an absolute url (relative to the baseUrl)
jet.get(url, body ={}, data={})
.then(res => {
    // do something with the response
})
.catch(err => {
    // do something with the error
})
```

## Defining custom request methods

If the request method you are looking for is not provided among the top five, you can define your own request method.

```js
// define your own request method
// type is the name of the method eg 'HEAD'
// body refers to the body of the request
// data refers to the request configuration
// url refers to the url of the request, can be a relative url or an absolute url (relative to the baseUrl)
jet
  .custom(url, type, (body = {}), (data = {}))
  .then((res) => {
    // do something with the response
  })
  .catch((err) => {
    // do something with the error
  });
```

## Authentication interceptor
This is a new feature that has been added from version `1.0.3` that enables you to tell `jwt-fetch` to automatically intercept any request and attach authentication token - JWT. 

To get this functionality working very well, follow the example below on your package instatiation. Please read through the comments to understand how the module works.

```JS
// first ofcourse import the library
import Jet from 'jet-fetch';

// then instantiate it.
// On this point of instatiation, you can define your baseUrl and your token source
// let me try to get my token from somewhere so that the library does not handle that for me.
// NOTE: You should only do this if your package is not stored in localstorage, 
// otherwise you may be repeating exactly what the packege is here to save you from
let my_token = sessionStorage.getItem("my_token") // my_token this is how you are saving your token.
const jet  = new JET()
jet.baseUrl = "https://my_api_url.com/api/"
jet.token = my_token; // here you are telling the library that on every request, try to get the this token.

console.log(jet)
```

## With JWT Authentication
We understand that most modern platforms are using Bearer Tokens or JWT or OAuth for securing their platforms therefore, the library ships in with amazing and simple to use tools for this.

### Instantiating with JWT in mind.
If your app is using JWT authentication, which in most cases will be stored in `localstorage` as `Bearer`, you can define your `Jet` class as below. If this is the case for you, then the code below is enough for you.
```JS

import Jet from 'jet-fetch';

const jet = new Jet(
  baseUrl = "https:your-cool-base-url.com",
  interceptWithJWTAuth = true // notice this.
  )
```

With just the above, the library will try to load the JWT from the localstorage, send it to the backend as "Bearer \<token from the localstorage>" and add to your "Authorization" header attribute.

### Customising the above.

If your backend forexample does not expect the token as `Bearer`, maybe it expects it as `Token` or `JWT`, then your class should have an additional parameter `sendTokenAs` and if not defined will always default to `Bearer`.

Example:
```JS
import Jet from 'jet-fetch';

const jet = new Jet(
  baseUrl = "https:your-cool-base-url.com",
  interceptWithJWTAuth = true,
  sendTokenAs="Token" // notice this
)
```

If your token is not stored as `Bearer` in your localstorage, maybe you keep it as `secretkey`, then you call tell the package to look for that like this.

```JS
import Jet from 'jet-fetch';

const jet = new Jet(
  baseUrl = "https:your-cool-base-url.com",
  interceptWithJWTAuth = true,
  tokenBearerKey="secretkey" // notice this
)
```

### Full Customising
The above will work for when you token is in your localstorage and really available for use. 

But imagine one who is keeping this token in maybe sessionStorage or anywhere else.

Then it is also to define your interceptio with your own source of code like below. Remember this should be done on class instatiation otherwise it may break.

As long as you endup with the code. The rest will work fine.
```JS
import Jet from 'jet-fetch';

// here the user is getting the token from the sessionStorage.
let my_token = sessionStorage.getItem("token")

const jet = new Jet(
  baseUrl = "https:your-cool-base-url.com",
  interceptWithJWTAuth = true,
  token = my_token
)
```

NOTE: When `token` is defined in the class, it will take precendence of the rest of the parameters you pass expect `interceptWithJWTAuth`. Which means, the library won't be checking in your localstorage at all.

But with this last one, Remember our token will be sent as `Bearer`, to customize that, just like as explained above, define your `sendTokenAs`. in the class instantiation.

```JS
import Jet from 'jet-fetch';

// here the user is getting the token from the sessionStorage.
let my_token = sessionStorage.getItem("token")

const jet = new Jet
jet.baseUrl = "https:your-cool-base-url.com"
jet.token = my_token
jet.sendTokenAs ="JWT"

```

Now, after fully defining your `Jet` instance, you can then export it and start using it in the rest of your application.

```JS
import Jet from 'jet-fetch';

// here the user is getting the token from the sessionStorage.
let my_token = sessionStorage.getItem("token")

const jet =  new Jet
jet.baseUrl = "https:your-cool-base-url.com"
jet.token = my_token
jet.sendTokenAs ="JWT"

export default jet;
```

Goodluck with the new way of having fun with `APIS`.


## Contributing

Fork this repo, make your changes, test them and then make a pull request.


## Known Issues
The package works well with JS modules. Incase you get any importation issues, save your file as `.mjs` or define in your `package.json` `type` as `module`.