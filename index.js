import fetch from 'node-fetch';
// import localStorage from "localStorage";

/**
 * @baseUrl defines the base url of all the requests.
 * if not provided, absolute urls on each request will be required.
 * 
 * @interceptWithJWTAuth boolean, if provided, for every request, an attempt to find 
 *  the @tokenBearerKey provided from localstorage will be made if the token was not provided.
 * @tokenBearerKey defines how the token is stored in your localstorage. 
 * 
 * @token is your defined jwt token which wilbe passed in the Authorisation header. if not provided, an attempt to fall back to 
 * getting the token from localstorage will be made.
 * @sendTokenAs defines how you want the token to be sent to the server, this by convention may be  JWT, BEARER, TOKEN but you can name it anything your want.
 * 
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

    async attachAuthorisatin() {
        // if the dev provided the token, use that, otherwise, attempt to get it from the localstorage
        let token = this.token? this.token:  localStorage.getItem(this.tokenBearerKey)
        
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



    setUrl(url) {
        return this.baseUrl ? this.baseUrl + "" + url : url
    }

    setHeaders(data, type) {
        //set the request method
        if (!data['type']) {
            data['type'] = type
        }
        // allow cors by default, user should set cors : true
        if (!data['cors']) {
            data['mode'] = 'cors'
        }
        // set allowed origins, otherwise will default to all
        if (!data['Access-Control-Allow-Origin'] || data['cors']) {
            data['Access-Control-Allow-Origin'] = "*"
        }
        //    set the defaylt caontent-type to application/json if non was provided
        if (!data['Content-Type']) {
            data['Content-Type'] = 'application/json'
        }

        if (this.interceptWithJWTAuth) {
            let auth = this.attachAuthorisatin
            // if it has something from auth, lets use it 
            if (auth && !data['Authorization']) {
                data['Authorization'] = auth['Authorization']
            }
        }

        return data
    }

    isEmpty(obj) {
        if (!obj) {
            return true
        } else if (Object.keys(obj).length === 0) {
            return true
        }
        return false
    }

    setBody(body, data) {
        if (!this.isEmpty(body)) {
            data['body'] = body
        }
        return data
    }

    populateData(body, data, type) {
        const dataWithHeaders = this.setHeaders(data, type)
        return this.setBody(body, dataWithHeaders)
    }

    async get(url, body = {}, data = {}) {
        const Data = this.populateData(body, data, 'GET')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }

    async post(url, body = {}, data = {}) {
        const Data = this.populateData(body, data, 'POST')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }

    async patch(url, body = {}, data = {}) {
        const Data = this.populateData(body, data, 'PATCH')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }



    async put(url, body = {}, data = {}) {
        const Data = this.populateData(body, data, 'PUT')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }


    async delete(url, body = {}, data = {}) {
        const Data = this.populateData(body, data, 'DELETE')
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }

    async custom(url, type, body = {}, data = {}) {
        const Data = this.populateData(body, data, type)
        const newUrl = this.setUrl(url)
        try {
            return this.flyer(newUrl, Data)
        } catch (e) {
            return Promise.reject(e)
        }
    }
}


export default Jet