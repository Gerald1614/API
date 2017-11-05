'use strict';

const logger = require('winston');
const elasticsearch = require('elasticsearch');

/**
 * test query: http://localhost:3030/search?token=bird
 * 
 * 
 * https://gist.github.com/StephanHoyer/b9cd6cbc4cc93cee8ea6
 * 
 * 
 */
class ElasticsearchWrapper {

  setApp(app) {
    this.app = app;

    const contributionService = app.service('contributions');
    logger.info("ES Wrapper setup");
    logger.info("contibutionService:" + contributionService);
  }

  dropIndex() {
    let client = this.getClient();
    client.indices.exists('hc', function (response) {
      logger.info('index exists: ' + response);
      logger.info('index exists: ' + JSON.stringify(response));
      return client.indices.delete({
        index: 'hc',
      });
    });

  }

  createIndex() {
    let client = this.getClient();
    return client.indices.create({
      index: 'hc',
      mapping: {
        contribution: {
          title: {
            type: 'string'
          }
        }
      }
    });
  }

  async add(contribution) {
    let client = this.getClient();
    logger.info("ES001 add contribution: "+ JSON.stringify(contribution));

    let creationDate = contribution.createdAt;

    let addResult = await client.create({
      index: 'hc',
      type: 'contribution',
      id: contribution.title,
      body: {
        title: contribution.title,
        content: contribution.content,
        user_id: contribution.userId,
        date: creationDate,
        value: contribution
      }
    });

    logger.info("ES001 add result:" + JSON.stringify(addResult));
  }

  insert(contribution, onResponse, onError) {
    let client = this.getClient();

    let creationDate = Date.now;

    client.create({
      index: 'hc',
      type: 'contribition',
      id: contribution.title,
      body: {
        title: contribution.title,
        content: contribution.content,
        user_id: contribution.user,
        date: creationDate
      }
    }, function (error, response) {
      logger.debug('response:', JSON.stringify(response));
      onResponse(response);
      onError(error);

      client.close();
    });
  }

  async find(params) {
    logger.info('SearchService.find');

    //find by params:{"query":{"$skip":0,"$sort":{"createdAt":-1},"$search":"et"},"provider":"socketio"}
    logger.info('ES001 find by params:' + JSON.stringify(params));
    let token = params.query.$search;
    //let token = params.query.token;
    logger.info('ES001 token:' + token);

    //START SEARCH
    let client = this.getClient();
    let query = {
      index: 'hc',
      type: 'contribution',
      body: {
        query: {
          dis_max: {
            tie_breaker: 0.6,
            queries: [
              {
                fuzzy: {
                  title: {
                    value: token,
                    fuzziness: 'AUTO',
                    prefix_length: 0,
                    max_expansions: 20,
                    transpositions: false,
                    boost: 1.0
                  }
                }
              },
              {
                fuzzy: {
                  content: {
                    value: token,
                    fuzziness: 'AUTO',
                    prefix_length: 0,
                    max_expansions: 80,
                    transpositions: false,
                    boost: 1.0
                  }
                }
              }
            ],
            boost: 1.0
          }
        }
      }
    };

    //TODO RB: filter results
    let result =  await client.search(query);
    logger.info("ES001 search result:" + JSON.stringify(result));
    let totalHits = result.hits.total;
    logger.info("ES001 total hits:" + totalHits);
    if(totalHits === 0){
      result = this.getNoResultsFoundResponse();
    }else{
      let value = this.getNoResultsFoundResponse();
      value.total = result.hits.total;
      
      // test RB
      value.total = 1;

      
      value.data[0] = result.hits.hits[0]._source.value;
      // value.data[0]._id = "1234";

      logger.info("ES001 result value:" + JSON.stringify(value));
      result = value;
      
    }
    return result;


  }

  getNoResultsFoundResponse(){
    let result = {total:0,
            limit:10,
            skip:0,
            data:[]}
    return result;
  }
  getClient() {
    let client = new elasticsearch.Client({
      host: 'localhost:9200',
      apiVersion: '5.6',
      log: 'trace'
    });
    return client;
  }

  close(client) {
    client.close();
  }

}



module.exports = ElasticsearchWrapper;
