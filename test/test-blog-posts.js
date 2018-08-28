'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

//this makes the expect syntax available throughout the testing module
const expect = chai.expect;

const { BlogPost } = require('../models');
const { closeServer, runServer, app } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);
const should = chai.should();

function seedBlogPostData(){
  console.info('Seeding blog data');
  const seedData = []; //declaring empty array to be used to contain seed data in a given test
  for (let i = 1; i < 10; i++){//why start at 1 instead of 0? does this have something to do with the database?
    seedData.push(generateBlogPostData());//pushing each instance of the returned data onto the array from generateBlogPostData
  }
  return BlogPost.insertMany(seedData);//inserts the generated array into the collection and returns a promise
}

function generateBlogPostData(){//utilizes faker to generate fake blog post information for our array
  return {//return the data so that it can be pushed into the array in seedBlogData
    author:{
      firstName:faker.name.firstName(),//name and lorem are both parts of faker used for generating fake data
      lastName:faker.name.lastName()
    },
    title:faker.lorem.sentence(),
    content: faker.lorem.text()
  };
}

function tearDownDb(){//function that gets called to delete our test database
  console.warn('Deleting test database');
  return mongoose.connection.dropDatabase();//mongoose function to delete the database/associated data files
}

describe('Blog Posts API resource', function(){
  before(function(){//before any tests have been run
    return runServer(TEST_DATABASE_URL);//runs the server utilizing the test_database_url specified in our config file
  });

  beforeEach(function(){//meaning before each test, seed the database so that there is something to test
    return seedBlogPostData();
  });

  afterEach(function(){//meaning after each test, delete the database
    return tearDownDb();
  });

  after(function(){//after all tests have been run
    return closeServer();//does this ever need to have an argument? for example: test_database_url?
  });

  describe('GET endpoint', function() {
    it('should return all existing blog posts', function() {//essentially just checks to make sure all existing blog posts are returned
      let res;//declared here because we need to have access to it across multiple .then calls
      return chai.request(app)
        .get('/posts')
        .then(function(_res){//using _res as to not conflict with the res declared above outside of this request
          res = _res;//setting the declared res to the _res in the .then statement
          expect(res).to.have.status(200);//check to make sure request has succeeded
          expect(res.body).to.have.lengthOf.at.least(1);
          return BlogPost.count();
        })
        .then(function(count){
          expect(res.body).to.have.lengthOf(count);
        });
    });

    it('should return blog posts with the correct fields/keys', function(){//checks to make sure all the existing blog posts are formatted correctly and have the correct keys
   
      let resPost;//again declaring this outside so that it can be used across multiple .then statements
      return chai.request(app)
        .get('/posts')
        .then(function(res){
          expect(res).to.have.status(200);//check to make sure request has succeeded
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.lengthOf.at.least(1);//since we are seeding the database, there should always be 1 or more

          res.body.forEach(function(post){//for each post in the body, it should be an object and include the relevant keys
            expect(post).to.be.a('object');
            expect(post).to.include.keys('id', 'title', 'content', 'author', 'created');
          });
          resPost = res.body[0];//sets resPost equal to the first post in the response array
          return BlogPost.findById(resPost.id);//returns the id of the first post in the body
        })
        .then(post => {//ensures that we have data consistency across requests
          expect(resPost.title).to.equal(post.title);
          expect(resPost.content).to.equal(post.content);
          expect(resPost.author).to.equal(post.authorName);
        });
    });
  });//end of describe GET

  describe('POST endpoint', function() {
    it('should add a new blog post', function(){
      const newBlogPost = generateBlogPostData();//creating a new restaurant that we can send in the request...declared outside so that it can be used in second .then request for comparisons
      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)//newly generated blog post that is sent in the post request body
        .then(function (res) {
          expect(res).to.have.status(201);//201 indicates that a resource has been created
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys('id', 'title', 'content', 'author', 'created');
          expect(res.body.title).to.equal(newBlogPost.title);
          expect(res.body.id).to.not.be.null;
          expect(res.body.author).to.equal(
            `${newBlogPost.author.firstName} ${newBlogPost.author.lastName}`);
          res.body.content.should.equal(newBlogPost.content);
          return BlogPost.findById(res.body.id);//we use the id from the response object of the newly posted blog post
        })
        .then(function (post) {//comparisons to make sure that the posted blog post is the same as the one that we intended it to be
          expect(post.title).to.equal(newBlogPost.title);
          expect(post.content).to.equal(newBlogPost.content);
          expect(post.author.firstName).to.equal(newBlogPost.author.firstName);
          expect(post.author.lastName).to.equal(newBlogPost.author.lastName);
        });
    });
  });//end of describe POST


  describe('PUT endpoint', function() {
    it('should update fields in a given blog post', function(){
      const updatedBlogFields = {//manually updating some fields
        title:'Updated blog post for PUT testing purposes',
        content:'This is updated content from a test of our PUT endpoint'
      };

      return BlogPost
        .findOne()//finds one post
        .then(function(post){
          updatedBlogFields.id = post.id;//sets the updated post to the id of the post found
          return chai.request(app)
            .put(`/posts/${post.id}`)//uses the id from the findOne post so that we can update it in our test
            .send(updatedBlogFields);//sends the updated information declared above
        })//seems like if there is a .then coming after, we don't want a semicolon here as a general rule
        .then(function(res){
          expect(res).to.have.status(204);//successful response with no content since it is a put
          return BlogPost.findById(updatedBlogFields.id);//returns the id
        })
        .then(function(post){//comparison to make sure that the posted blog post is updated like the content we intended it to have
          expect(post.title).to.equal(updatedBlogFields.title);
          expect(post.content).to.equal(updatedBlogFields.content);
        });
    });
  });//end of describe PUT

  describe('DELETE endpoint', function() {
    it('should delete a given blog post using its id', function(){
      let post;//why not just use _post for this entire one?
      return BlogPost
        .findOne()
        .then(function(_post){
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res){
          expect(res).to.have.status(204);//no content expected since this is a DELETE endpoint
          return BlogPost.findById(post.id);
        })
        .then(function(_post){
          expect(_post).to.be.null;//should be null since it shouldnt exist anymore
        });
    });
  });
});//end of describe DELETE