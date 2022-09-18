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

## Contributing

Fork this repo, make your changes, test them and then make a pull request.

## Installation

Simply run 
```bash
npm i jet-fetch
```

## Known Issues
The package works well with JS modules. Incase you get any importation issues, save your file as `.mjs` or define in your `package.json` `type` as `module`.