const assert = require("assert");
function fact(x) {
    if (x <= 1) {
        return 1;
    } else {
        return x * fact(x-1);
    }
}

assert.equal(120, fact(5));
