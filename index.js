import fetch from 'node-fetch';
// import localStorage from "localStorage";

/**
* @baseUrl defines the base url of all the requests.
* if not provided, absolute urls on each request will be required.
* 
* @interceptWithJWTAuth boolean, if provided, for every request, an attempt to find 
*  the @tokenBearerKey provided from localstorage will be made if the token was not provided.
* @tokenBearerKey defines how the token is stored in your localstorage. 
* @token is your defined jwt token which wilbe passed in the Authorisation header. if not provided, an attempt to fall back to 
* getting the token from localstorage will be made.
* @sendTokenAs defines how you want the token to be sent to the server, this by convention may be  JWT, BEARER, TOKEN but you can name it anything your want.
* 
*/
class Jet {
    constructor(baseUrl = null, interceptWithJWTAuth=false, token=null, tokenBearerKey="Bearer", sendTokenAs="Bearer") {
        this.baseUrl = baseUrl
        this.token = token
        this.tokenBearerKey = tokenBearerKey
        this.sendTokenAs = sendTokenAs
        this.interceptWithJWTAuth = interceptWithJWTAuth
        this.headers = {}
    }
    
    async attachAuthorisation() {
        // if the dev provided the token, use that, otherwise, attempt to get it from the localstorage
        let token = this.token ? this.token:  localStorage.getItem(this.tokenBearerKey)
        
        if (token) {
            return this.generateAuthHeader(this.token)
        }
        return null
    }
    
    
    async generateAuthHeader(token) {
        let _header_string = {
            Authorization: null
        }
        _header_string['Authorization'] = this.sendTokenAs + " " + token
        return _header_string
    }
    
    async flyer(url, data) {
        try {
            const response = await fetch(url, data)
            const resData = await response.json()
            const res = {
                'response': response,
                'data': resData
            }
            return Promise.resolve(res)
        } catch (err) {
            return Promise.reject(err)
        }
    }

        
    /**
    * Checks if an object is empty
    * @param {object} obj The object to check
    * @returns bool 
    * */
    isEmpty(obj) {
        if (!obj) {
            return true
        } else if (Object.keys(obj).length === 0) {
            return true
        }
        return false
    }
    
    /**
    * Sets the body part of the request
    * @param {object} body-> Request body
    * @param {object} config-> Request configurations
    * @returns Object -> Configuration with body combined
    */
    _setBody(body, config) {
        if (body!=null && !this.isEmpty(body)) {
            config['body'] = JSON.stringify(body)
        }
        return config
    }

    _setType(config, type) {
        //set the request method
        if (config && !("type" in config)) {
            config['method'] = type.toUpperCase()
        }
        return config
    }

    _getHeaders() {
        return this.headers
    }

    _setHeaders(headers = {}) {
        this.headers = { ...this._getHeaders(), ...headers }
    }

    _setUrl(url) {
        if (this.baseUrl) {
            let newBase = this.baseUrl
            let newLink = url
            if (newBase.charAt(newBase.length - 1) !== "/") {
                newBase = newBase+"/"
            }
            if (newLink.charAt(0) == "/") {
                newLink = newLink.substring(1, newLink.length -1)
            }
            return `${newBase}${newLink}`
        }
        return url
    }

    _extractHeadersFromConfigs(config={}) {
        let config_keys = Object.keys(config)

        if (config_keys.length > 0 && config_keys.includes("headers")) {
            this._setHeaders(config['headers'])
        }

         // set allowed origins, otherwise will default to all
        if (!("Access-Control-Allow-Origin" in this.headers) || "cors" in config) {
            this._setHeaders({ 'Access-Control-Allow-Origin' : "*"})
        }
        // set the default content-type to application/json if non was provided
        if (!("Content-Type" in this.headers)) {
            this._setHeaders({ 'Content-Type' : 'application/json'})
        }
        
        if (this.interceptWithJWTAuth) {
            let auth = this.attachAuthorisation
            // if it has something from auth, lets use it 
            if (auth && !("Authorization" in this.headers)) {
                this._setHeaders({ 'Authorization' : auth['Authorization']})
            }
        }
        
        return this.headers
    }

    /**
    * Populates the body and configurations of the request, should not be called directly from the instannce
    * @protected
    * @param {object} body Request body/data
    * @author jet2018
    * @param {object} configs Request configurations such as headers and any other settings
    * @see [customising fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#supplying_your_own_request_object)
    * @param headers Request headers
    * @param {string} type Request type, that is, post, get, put ...
    * @returns Object
    */
    _populateData(type = "GET", body = null, headers = null, configs = null) {
        // set the body if the request is not get
        if (body !== null && type !== "GET") {
            configs = {...configs, ...this._setBody(body, configs) }
        }
        // attach the headers
        if (headers != null) {
            configs = { ...configs, ...this._setHeaders(headers) }
        }
        configs = { ...configs, ...this._setType(configs, type) }
        this._extractHeadersFromConfigs(configs)
        configs['headers'] = this.headers
        return configs
    }

    _requestDefinition(url, type, body, headers, config) {
        const newUrl = this._setUrl(url)
        const data = this._populateData(type, body, headers, config)
        return { newUrl, data }
    }
    
    /**
    * Makes a GET request to the server
    * @author jet2018
    * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
    * @param {object} headers Request headers
    * @param {object} config The request configuration
    * @returns Promise
    */
    async get(url, headers = {}, config = {}) {
        const {newUrl, data} = this._requestDefinition(url, "GET", null, headers, config)
        try {
            return this.flyer(newUrl, data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    
    /**
    * Makes a POST request to the server
    * @author jet2018
    * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
    * @param {object} body The body of the request.
    * @param {object} headers The request headers
    * @param {object} config The request configuration
    * @returns Promise
    */
    async post(url, body = {},  headers={}, config = {}) {
        const { newUrl, data } = this._requestDefinition(url, "POST", body, headers, config)
        try {
            return this.flyer(newUrl, data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    
    /**
    * Makes a PATCH request to the server
    * @author jet2018
    * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
    * @param {object} body The body of the request.
    * @param {object} headers The request headers
    * @param {object} config The request configuration
    * @returns Promise
    */
    async patch(url, body = {},  headers={}, config = {}) {
        const {newUrl, data} = this._requestDefinition(url, "PATCH", body, headers, config)
        try {
            return this.flyer(newUrl, data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    
    
    /**
    * Makes a PUT request to the server
    * @author jet2018
    * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
    * @param {object} body The body of the request.
    * @param {object} headers The request headers
    * @param {object} config The request configuration
    * @returns Promise
    */
    async put(url, body = {}, headers={}, config = {}) {
        const { newUrl, data } = this._requestDefinition(url, "PUT", body, headers, config)
        try {
            return this.flyer(newUrl, data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    
    /**
    * Makes a DELETE request to the server
    * @author jet2018
    * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
    * @param {object} body The body of the request.
    * @param {object} headers The request headers
    * @param {object} config The request configuration
    * @returns Promise
    */
    async delete(url, body = {}, headers={}, config = {}) {
        const {newUrl, data} = this._requestDefinition(url, "DELETE", body, headers, config)
        try {
            return this.flyer(newUrl, data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    
    /**
    * If the pre-configured request types are not working for you, using this endpoint enables you to configure your own ground up.
    * @author jet2018
    * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
    * @param {string} type Request type, can be GET, PUT, PATCH, DELETE etc
    * @param {object} body The body of the request.
    * @param {object} headers The request headers
    * @param {object} config The request configuration
    * @returns Promise
    */
    async custom(url, type, body = {}, headers={}, config = {}) {
        const {newUrl, data} = this._requestDefinition(url, type, body, headers, config)
        try {
            return this.flyer(newUrl, data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
}


export default Jet
