var request = require('supertest')
  , w3c     = require('w3c-validate').createValidator();
var assert = require('assert');

var app = require("../server")

describe('html validation', function(){
  this.timeout(10000);
  it('page should have no html errors', function(done){
    request(app)
      .get('/')
      .expect(200)
      .end(function(err, res){
        if (err) return done(err);
        w3c.validate(res.text, done);
      });
  })
});