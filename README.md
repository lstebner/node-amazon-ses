# Amazon SES

A simple Amazon SES wrapper, supports the following actions:

* DeleteVerifiedEmailAddress
* GetSendQuota
* GetSendStatistics
* ListVerifiedEmailAddresses
* SendEmail
* VerifyEmailAddress

Does not currently support SendRawEmail.

## Install

<pre>
  npm install amazon-ses
</pre>

Or from source:

<pre>
  git clone git://github.com/jjenkins/node-amazon-ses.git
  cd amazon-ses
  npm link .
</pre>

## Verify Source Email

Verify the source email address with Amazon.

<pre>
  var AmazonSES = require('amazon-ses');
  var ses = new AmazonSES('access-key-id', 'secret-access-key');
  ses.verifyEmailAddress('foo@mailinator.com');
</pre>

You will receive a confirmation email - click the link in that email to finish the verification process.

## Send Email

<pre>
  ses.send({
      from: 'foo@mailinator.com'
    , to: ['bar@mailinator.com', 'jim@mailinator.com']
    , replyTo: ['john@mailinator.com']
    , subject: 'Test subject'
    , body: {
          text: 'This is the text of the message.'
        , html: 'This is the <b>html</b> body of the message.'
    }
  });
</pre>

## Use Mustache Templates

You can also send an email using a Mustache template instead of putting all the content into the 'body' object passed to send(). To do so simply specify a `template` and `templateData`. Here is a super simple example:

```javascript
  ses.send({
    //from, to, etc
    template: 'Hello {{name}},<br /><br />Welcome to <strong>The Greatest Email Ever!</strong>',
    templateData: { name:'Hamburglar' }
  });
```

Not saving you a ton of work there yet, but the beauty is that you can also pass it a file name and it will use that file as the Mustache template. It's syntactically the same, you would just pass the filename instead of the template string.

```javascript
  ses.send({
    //from, to, etc
    template: '/welcome.txt',
    templateData: { name:'Hamburglar' }
  });
```

This will look for the file in a '/views/' folder and assumes no further directories or file extensions.

## Get verified email addresses

<pre>
  ses.listVerifiedEmailAddresses(function(result) {
    console.log(result);
  });
</pre>

## Deleted a verified email address

<pre>
  ses.deleteVerifiedEmailAddress('foo@mailinator.com', function(result) {
    console.log(result);
  });
</pre>

## Get Quota and Stats

<pre>
  ses.getSendQuota(function(result) {
    console.log(result);
  });

  ses.getSendStatistics(function(result) {
    console.log(result);
  });
</pre>
