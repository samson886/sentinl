/*
 * Copyright 2016, Lorenzo Mangani (lorenzo.mangani@gmail.com)
 * Copyright 2015, Rao Chenlin (rao.chenlin@gmail.com)
 *
 * This file is part of Sentinl (http://github.com/sirensolutions/sentinl)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import getElasticsearchClient from './get_elasticsearch_client';
import _ from 'lodash';

const dynamicTemplates = [ {
  string_fields : {
    mapping : {
      type : 'string',
      index : 'not_analyzed',
      doc_values: true,
      fields : {
        search : {
          index : 'analyzed',
          omit_norms : true,
          type : 'string',
        }
      }
    },
    match_mapping_type : 'string',
    match : '*'
  }
}];

const createIndex = function (server, config, indexName, docType, mappings) {
  server.log(['status', 'info', 'Sentinl'], `Checking ${indexName} index ...`);
  if (!server.plugins.elasticsearch) {
    server.log(['status', 'error', 'Sentinl'], 'Elasticsearch client not available, retrying in 5s');
    tryCreate(server);
    return;
  }

  // if doc type is not default
  if (docType !== _.keys(mappings.mappings)[0]) {
    const body = mappings.mappings.user;
    delete mappings.mappings.user;
    mappings.mappings[docType] = body;
  }

  const client = getElasticsearchClient(server, config);

  client.indices.exists({
    index: indexName
  })
  .then((exists) => {
    if (exists === true) {
      server.log(['status', 'debug', 'Sentinl'], `Index ${indexName} exists!`);
      return;
    }
    server.log(['status', 'info', 'Sentinl'], `Creating ${indexName} index ...`);

    client.indices.create({
      index: indexName,
      body: mappings
    })
    .then(function (resp) {
      server.log(['status', 'debug', 'Sentinl'], `Index ${indexName} response`, resp);
    }).catch((err) => server.log(['status', 'error', 'Sentinl'], err.message));
  })
  .catch((error) => server.log(['status', 'error', 'Sentinl'], `Failed to check if core index exists: ${error}`));
};


function createSentinlIndex(server, config) {
  server.log(['status', 'info', 'Sentinl'], 'Core Index check...');
  if (!server.plugins.elasticsearch) {
    server.log(['status', 'error', 'Sentinl'], 'Elasticsearch client not available, retrying in 5s');
    tryCreate(server);
    return;
  }

  const client = getElasticsearchClient(server);

  client.indices.exists({
    index: config.es.default_index
  })
  .then((exists) => {
    if (exists === true) {
      server.log(['status', 'debug', 'Sentinl'], 'Core Index exists!');
      return;
    }
    server.log(['status', 'info', 'Sentinl'], 'Creating Sentinl core Index...');

    client.indices.create({
      index: config.es.default_index,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1
        },
        mappings: {
          watch: {
            properties: {
              input: {
                type: 'object',
                enabled: false
              },
              action: {
                type: 'object',
                enabled: false
              },
              transform: {
                type: 'object',
                enabled: false
              },
              condition: {
                type: 'object',
                enabled: false
              },
              uuid: {
                type:  'string',
                index: 'not_analyzed'
              },
              report: {
                type: 'boolean'
              },
              disable: {
                type: 'boolean'
              }
            }
          }
        }
      }
    })
    .then(function (resp) {
      server.log(['status', 'debug', 'Sentinl'], 'Core Index response', resp);
    }, function (err) {
      server.log(['status', 'error', 'Sentinl'], err.message);
    });
  })
  .catch((error) => server.log(['status', 'error', 'Sentinl'], `Failed to check if core index exists: ${error}`));
}

var tryCount = 0;
function tryCreate(server) {
  if (tryCount > 5) {
    server.log(['status', 'warning', 'Sentinl'], 'Failed creating Indices mapping!');
    return;
  }
  setTimeout(createSentinlIndex, 5000);
  tryCount++;
}


function createSentinlAlarmIndex(server, config) {
  server.log(['status', 'info', 'Sentinl'], 'Alarm Index check...');
  if (!server.plugins.elasticsearch) {
    server.log(['status', 'error', 'Sentinl'], 'Elasticsearch client not available, retrying in 5s');
    tryAlarmCreate(server);
    return;
  }

  const client = getElasticsearchClient(server);

  client.indices.exists({
    index: config.es.alarm_index
  })
  .then((exists) => {
    if (exists === true) {
      server.log(['status', 'debug', 'Sentinl'], 'Alarms Index exists!');
      return;
    }
    server.log(['status', 'info', 'Sentinl'], 'Creating Sentinl Alarms Template...');

    client.indices.putTemplate({
      name: config.es.alarm_index,
      body: {
        template: config.es.alarm_index + '-*',
        mappings: {
          _default_: {
            properties: {
              payload: {
                type: 'object',
                enabled:  false
              },
              attachment : {
                type : 'binary'
              },
              uuid: {
                type:  'string',
                index: 'not_analyzed'
              }
            }
          }
        }
      }
    })
    .then(function (resp) {
      server.log(['status', 'debug', 'Sentinl'], 'Alarm Template response', resp);
    }, function (err) {
      server.log(['error', 'error', 'Sentinl'], err.message);
    });

    server.log(['status', 'info', 'Sentinl'], 'Creating Sentinl Alarms Index...');

    client.indices.create({
      index: config.es.alarm_index,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1
        }
      }
    })
    .then(function (resp) {
      server.log(['status', 'debug', 'Sentinl'], 'Alarm Index response', resp);
    }, function (err) {
      server.log(['error', 'warning', 'Sentinl'], err.message);
    });
  })
  .catch((error) => server.log(['status', 'error', 'Sentinl'], 'Failed to check if core index exists', error));
}

var tryAlarmCount = 0;
function tryAlarmCreate(server) {
  if (tryCount > 5) {
    server.log(['error', 'warning', 'Sentinl'], 'Failed creating Alarm Indices mapping!');
    return;
  }
  setTimeout(createSentinlAlarmIndex, 5000);
  tryAlarmCount++;
}


module.exports = {
  createSentinlAlarmIndex: createSentinlAlarmIndex,
  createSentinlIndex: createSentinlIndex,
  createIndex: createIndex,
  tryCreate: tryCreate,
  tryAlarmCreate: tryAlarmCreate
};
