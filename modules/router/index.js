class Router {
    constructor() {
        this.root = document.getElementById('root');
    }
    to(url = null, params = null) {
        return this;
    }

    goTo() {
        return this;
    }

    back() {
        return this;
    }

    forward() {
        return this;
    }

    replace() {
        return this;
    }
}

export { Router }