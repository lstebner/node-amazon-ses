var _ = require('underscore');
var crypto = require('crypto');
var qs = require('querystring');
var request = require('request');
var xml = require('xml2js');
var mustache = require('mustache');
var fs = require('fs');
var path = require('path');

var AmazonSES = (function() {

  var init = function(key, secret) {
    this.accessKeyId = key;
    this.secretAccessKey = secret;
  };

  var hmac = function(key, str) {
    var hash = crypto.createHmac('sha256', key);
    return hash.update(str).digest('base64');
  };

  var getDestinationList = function(addresses, type) {
    var list = {};
    _.each(addresses, function(address, idx) {
        var key = 'Destination.'+ type +'Addresses.member.' + (idx + 1);
        list[key] = address;
    });
    return list;
  };
  
  var getReplyToList = function(addresses) {
    var list = {};
    _.each(addresses, function(address, idx) {
        var key = 'ReplyToAddresses.member.' + (idx + 1);
        list[key] = address;
    });
    return list;
  };

  //this function will attempt to render a mustache template to HTML for the email content
  //unfortunately because reading the filesystem requires a callback, you must specify a 
  //callback when loading a template
  var loadTemplate = function(opts, fn){
        //a place to store the rendered HTML content
    var rendered = ''
        //this callback will call the other callback, passing the rendered HTML
        ,done = function(){
          if (fn){ fn( rendered ); }
        }
    ;

    //make sure template data is specified
    if (!opts.hasOwnProperty('template') || !opts.hasOwnProperty('templateData')){
      //if it wasn't, then we just quit now
      done();
    }
    //check if it was a file that was passed (otherwise we assume it was the template string itself)
    else if (opts.template.indexOf('.txt') > -1){
      fs.readFile(path.join(process.cwd(), 'views', opts.template), 'utf8', function(err, data){
        //error reading file
        if (err){ console.log('error reading email template: ' + err); }
        //file was read, use the content to render the template
        else{
          rendered = mustache.to_html(data, opts.templateData);
          done();
        }
      });
    }
    //a file wasn't passed, but some content in 'template' was so we are going to assume that it is
    //the mustache template itself and just render it out
    else{
      rendered = mustache.to_html(opts.template, opts.templateData);
      done();
    }
  }
  
  var buildMessage = function(opts) {
    var params = {
        'Action': 'SendEmail'
      , 'Source': opts.from
      , 'Message.Body.Text.Data': opts.body.text
      , 'Message.Body.Text.Charset': 'UTF-8'
      , 'Message.Body.Html.Data': opts.body.html
      , 'Message.Body.Html.Charset': 'UTF-8'
      , 'Message.Subject.Data' : opts.subject
    };
    _.extend(params, getDestinationList(opts.to, 'To'));
    _.extend(params, getDestinationList(opts.cc, 'Cc'));
    _.extend(params, getDestinationList(opts.bcc, 'Bcc'));
    _.extend(params, getReplyToList(opts.replyTo));
    
    return params;
  };

  var call = function(opts) {
    var host = 'email.us-east-1.amazonaws.com';
    var path = '/';

    var now = (new Date()).toUTCString();
    var body = qs.stringify(opts.query);

    var authorization =
        'AWS3-HTTPS '
      + 'AWSAccessKeyId=' + this.accessKeyId
      + ',Algorithm=HmacSHA256'
      + ',Signature=' + hmac(this.secretAccessKey, now)

    var headers = {
        'Date': now
      , 'Host': host
      , 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      , 'Content-Length': body.length
      , 'X-Amzn-Authorization': authorization
    };

    var options = {
        method: 'POST'
      , uri: 'https://' + host + path
      , headers: headers
      , body: body
    };

    request(options, function(error, response, body) {
      var parser = new xml.Parser();
      parser.addListener('end', function(data) {
        var err = null;
        if (data.hasOwnProperty('Error')) {
          err = new Error(data.Error.Message);
        }
        opts.callback(err, data);

      });
      parser.parseString(body);
    });
  };

  var Constructor = function(accessKeyId, secretAccessKey) {
    init(accessKeyId, secretAccessKey);
  };

  Constructor.prototype = {
    constructor: AmazonSES,
    /**
     * Verify an email address. This action causes a confirmation email
     * message to be sent to the specified address.
     *
     * @params {String} email The email address to be verified
     * @params {Function} callback
     * @throws {Error}
     */
    verifyEmailAddress: function(email, callback) {
      call({
          query: {'Action': 'VerifyEmailAddress', 'EmailAddress': email}
        , callback: function(err, data) {
            if (err) throw err;
            if (callback) {
              callback(data.ResponseMetadata);
            }
        }
      });
    },
    /**
     * Return a list containing all of the email addresses that have been
     * verified.
     *
     * @params {Function} callback
     * @throws {Error}
     */
    listVerifiedEmailAddresses: function(callback) {
      call({
          query: {'Action': 'ListVerifiedEmailAddresses'}
        , callback: function(err, data) {
            if (err) throw err;

            var result = data.ListVerifiedEmailAddressesResult;
            if (callback) {
              callback(result.VerifiedEmailAddresses.member);
            } else {
              throw Error("Must pass listVerifiedEmailAddresses a callback function");
            }
        }
      });
    },
    /**
     * Delete the specified email address from the list of verified
     * addresses.
     *
     * @params {String} email The email address to delete
     * @params {Function} callback
     */
    deleteVerifiedEmailAddress: function(email, callback) {
      call({
          query: {'Action': 'DeleteVerifiedEmailAddress', 'EmailAddress': email}
        , callback: function(err, data) {
            if (err) throw err;

            if (callback) {
              callback(data.ResponseMetadata);
            }
        }
      });
    },
    /**
     * Return the user's current sending limits.
     *
     * @params {Function} callback
     */
    getSendQuota: function(callback) {
      call({
          query: {'Action': 'GetSendQuota'}
        , callback: function(err, data) {
            if (err) throw err;

            if (callback) {
              callback(data.GetSendQuotaResult);
            } else {
              throw Error("Must pass getSendQuota a callback function");
            }
        }
      });
    },
    /**
     * Return the user's sending statistics. The result is a list of data
     * points, representing the last two weeks of sending activity. Each
     * data point in the list contains statistics for a 15-minute interval.
     *
     * @params {Function} callback
     */
    getSendStatistics: function(callback) {
      call({
          query: {'Action': 'GetSendStatistics'}
        , callback: function(err, data) {
            if (err) throw err;

            if (callback) {
              callback(data.GetSendStatisticsResult);
            } else {
              throw Error("Must pass getSendStatistics a callback function");
            }
        }
      });
    },
    /**
     * Composes an email message based on input data, and then immediately
     * queues the message for sending.
     *
     * @params {Object} message The email message components
     * @params {Function} callback
     */
    send: function(message, callback) {
      //note
      //I added this in to be able to pass a template (string) and templateData (object) to be 
      //rendered by mustache and used as the email content
      //template can either be a mustache template string or it can be a file relative to the 
      //views folder (include extension, none is assumed)
      loadTemplate(message, function(rendered){
        if (!_.isEmpty(rendered)){
          if (!message.hasOwnProperty('body')){
            message.body = {};
          }

          message.body.html = rendered;
        }

        call({
            query: buildMessage(message)
          , callback: function(err, data) {
              if (callback) callback(err, data);
          }
        });
      });
    }
  };

  return Constructor;

}());
module.exports = AmazonSES;
