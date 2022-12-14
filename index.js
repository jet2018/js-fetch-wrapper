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
     * Sets up the url of the request.
     * If the `baseUrl` was defined, it will just concatenate the given `url` to the `baseUrl` otherwise will send the url as is.
     * @param {string} url 
     * @returns string
     */
    setUrl(url) {

        // if the baseUrl does not end with a trailing slash, add it
        if (this.baseUrl != null && this.baseUrl.charAt(-1) != "/") {
            this.baseUrl = this.baseUrl + "/"
        }
        // remove it from the url
        if (this.baseUrl != null && url.charAt(0) == "/") {
            url.charAt(0) = ""
        }
        
        return this.baseUrl ? this.baseUrl + "" + url : url
    }

    /**
     * Configures the headers of the request, attempts to set the defaults if not provided
     * @description This will attempt to set the default request type if one not given, cors, Access-Control-Allow-Origin, and Content-Type.
     * All these can be overriden/customised  
     * @param {*} config 
     * @param {*} type 
     * @returns 
     */
    setHeaders(config, type) {
        //set the request method
        if (!config['type']) {
            config['type'] = type
        }
        // allow cors by default, user should set cors : true
        if (!config['cors']) {
            config['mode'] = 'cors'
        }
        // set allowed origins, otherwise will default to all
        if (!config['Access-Control-Allow-Origin'] || config['cors']) {
            config['Access-Control-Allow-Origin'] = "*"
        }
        // set the default content-type to application/json if non was provided
        if (!config['Content-Type']) {
            config['Content-Type'] = 'application/json'
        }

        if (this.interceptWithJWTAuth) {
            let auth = this.attachAuthorisation
            // if it has something from auth, lets use it 
            if (auth && !config['Authorization']) {
                config['Authorization'] = auth['Authorization']
            }
        }

        return config
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
    setBody(body, config) {
        if (!this.isEmpty(body)) {
            config['body'] = body
        }
        return config
    }

    /**
     * Populates the body and configurations of the request, should not be called directly from the instannce
     * @protected
     * @param {object} body Request body/data
     * @author jet2018
     * @param {object} config Request configurations such as headers and any other settings
     * @see [customising fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#supplying_your_own_request_object)
     * @param {string} type Request type, that is, post, get, put ...
     * @returns Object
     */
    populateData(body, config, type) {
        const dataWithHeaders = this.setHeaders(config, type)
        return this.setBody(body, dataWithHeaders)
    }

    /**
     * Makes a GET request to the server
     * @author jet2018
     * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
     * @param {object} body The body of the request. Usually GET requests do not pass in the body but send the body as query params
     * @param {object} config The request configuration
     * @returns Promise
     */
    async get(url, body = {}, config = {}) {
        const Data = this.populateData(body, config, 'GET')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }

    /**
     * Makes a POST request to the server
     * @author jet2018
     * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
     * @param {object} body The body of the request.
     * @param {object} config The request configuration
     * @returns Promise
     */
    async post(url, body = {}, config = {}) {
        const Data = this.populateData(body, config, 'POST')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }

    /**
     * Makes a PATCH request to the server
     * @author jet2018
     * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
     * @param {object} body The body of the request.
     * @param {object} config The request configuration
     * @returns Promise
     */
    async patch(url, body = {}, config = {}) {
        const Data = this.populateData(body, config, 'PATCH')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }


    /**
     * Makes a PUT request to the server
     * @author jet2018
     * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
     * @param {object} body The body of the request.
     * @param {object} config The request configuration
     * @returns Promise
     */
    async put(url, body = {}, config = {}) {
        const Data = this.populateData(body, config, 'PUT')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }

    /**
     * Makes a DELETE request to the server
     * @author jet2018
     * @param {string} url Relative or absolute url of the endpoint to hit. Providing the `baseUrl` automatically makes this relative to it 
     * @param {object} body The body of the request.
     * @param {object} config The request configuration
     * @returns Promise
     */
    async delete(url, body = {}, config = {}) {
        const Data = this.populateData(body, config, 'DELETE')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
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
     * @param {object} config The request configuration
     * @returns Promise
     */
    async custom(url, type, body = {}, config = {}) {
        const Data = this.populateData(body, config, type)
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
}


export default Jet
