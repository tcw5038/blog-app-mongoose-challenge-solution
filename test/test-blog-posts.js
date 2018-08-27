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
  return mongoose.connection.dropDatabase();//mongoose function to delete the database
}

describe('Blog Posts API resource', function(){
  before(function(){//before any tests have been run
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function(){//meaning before each test
    return seedBlogPostData();
  });

  afterEach(function(){//meaning after each test
    return tearDownDb();
  });

  after(function(){//after all tests have been run
    return closeServer();//seems like this can be empty...why?
  });

  describe('GET endpoint', function() {
    it('should return all existing blog posts', function() {
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res){
          res = _res;
          expect(res).to.have.status(200);//checks to see if our database seeding worked
          expect(res.body).to.have.lengthOf.at.least(1);
          return BlogPost.count();
        })
        .then(function(count){
          expect(res.body).to.have.lengthOf(count);
        });
    });

    it('should return blog posts with the correct fields/keys', function(){
   
      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res){
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.lengthOf.at.least(1);

          res.body.forEach(function(post){
            expect(post).to.be.a('object');
            expect(post).to.include.keys('id', 'title', 'content', 'author', 'created');
          });
          resPost = res.body[0];
          return BlogPost.findById(resPost.id);
        })
        .then(post => {
          expect(resPost.title).to.equal(post.title);
          expect(resPost.content).to.equal(post.content);
          expect(resPost.author).to.equal(post.authorName);
        });
    });
  });//end of describe GET

  describe('POST endpoint', function() {
    it('should add a new blog post', function(){
      const newBlogPost = generateBlogPostData();//creating a new restaurant that we can send in the request
      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
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
          return BlogPost.findById(res.body.id);
        })
        .then(function (post) {
          expect(post.title).to.equal(newBlogPost.title);
          expect(post.content).to.equal(newBlogPost.content);
          expect(post.author.firstName).to.equal(newBlogPost.author.firstName);
          expect(post.author.lastName).to.equal(newBlogPost.author.lastName);
        });
    });
  });//end of describe POST


  describe('PUT endpoint', function() {
    it('should update fields in a given blog post', function(){
      const updatedBlogFields = {
        title:'Updated blog post for PUT testing purposes',
        content:'This is updated content from a test of our PUT endpoint'
      };

      return BlogPost
        .findOne()
        .then(function(post){
          updatedBlogFields.id = post.id;
          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updatedBlogFields);
        })//seems like if there is a .then coming after, we don't want a semicolon here as a general rule
        .then(function(res){
          expect(res).to.have.status(204);
          return BlogPost.findById(updatedBlogFields.id);
        })
        .then(function(post){
          expect(post.title).to.equal(updatedBlogFields.title);
          expect(post.content).to.equal(updatedBlogFields.content);
        });
    });
  });//end of describe PUT

  describe('DELETE endpoint', function() {
    it('should delete a given blog post using its id', function(){
      let post;
      return BlogPost
        .findOne()
        .then(function(_post){
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res){
          expect(res).to.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post){
          expect(_post).to.be.null;
        });
    });
  });
});//end of describe DELETE