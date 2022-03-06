import fetch from 'node-fetch';

export default class Jet {
    constructor(baseUrl = null) {
        this.baseUrl = baseUrl
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

    async post(url, data = {}) {
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
}