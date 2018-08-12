(function (module) {
  "use strict";

  /*
    Welcome to the Metry SSO plugin! If you're inspecting this code, you're probably looking to
    hook up NodeBB with your existing OAuth endpoint.

    Step 1: Fill in the "constants" section below with the requisite informaton. Either the "oauth"
        or "oauth2" section needs to be filled, depending on what you set "type" to.

    Step 2: Give it a whirl. If you see the congrats message, you're doing well so far!

    Step 3: Customise the `parseUserReturn` method to normalise your user route's data return into
        a format accepted by NodeBB. Instructions are provided there. (Line 146)

    Step 4: If all goes well, you'll be able to login/register via your OAuth endpoint credentials.
  */

  var User = module.parent.require('./user');
  var Groups = module.parent.require('./groups');
  var meta = module.parent.require('./meta');
  var db = module.parent.require('../src/database');
  var passport = module.parent.require('passport');
  var fs = module.parent.require('fs');
  var path = module.parent.require('path');
  var nconf = module.parent.require('nconf');
  var winston = module.parent.require('winston');
  var async = module.parent.require('async');

	var controllers = require('./lib/controllers')(meta);
  var authenticationController = module.parent.require('./controllers/authentication');

  const gdprKey = "bypass-GDPR";

  /**
   * REMEMBER
   *   Never save your OAuth Key/Secret or OAuth2 ID/Secret pair in code! It could be published and leaked accidentally.
   *   Save it into your config.json file instead:
   *
   *   {
	 *     ...
	 *     "oauth": {
	 *       "id": "someoauthid",
	 *       "secret": "youroauthsecret"
	 *     }
	 *     ...
	 *   }
   *
   *   ... or use environment variables instead:
   *
   *   `OAUTH__ID=someoauthid OAUTH__SECRET=youroauthsecret node app.js`
   */

  var constants = Object.freeze({
      type: 'oauth2',	// Either 'oauth' or 'oauth2'
      name: 'metry',	// Something unique to your OAuth provider in lowercase, like "github", or "nodebb"
      oauth: {
        requestTokenURL: '',
        accessTokenURL: '',
        userAuthorizationURL: '',
        consumerKey: nconf.get('oauth:key'),	// don't change this line
        consumerSecret: nconf.get('oauth:secret'),	// don't change this line
      },
      oauth2: {
        authorizationURL: 'https://app.metry.io/oauth/authorize',
        tokenURL: 'https://app.metry.io/oauth/token',
        clientID: nconf.get('oauth:id'),	// don't change this line
        clientSecret: nconf.get('oauth:secret'),	// don't change this line
      },
      userRoute: 'https://app.metry.io/api/v2/accounts/me',	// This is the address to your app's "user profile" API endpoint (expects JSON)
      collaboratorRoute: 'https://app.metry.io/api/v2/accounts/me/authenticated_collaborator',
      scope: nconf.get('oauth:scope') || 'basic'
    });
  var configOk = false;
  var OAuth = {};
  var passportOAuth;
  var opts;

  if (!constants.name) {
    winston.error('[sso-metry] Please specify a name for your OAuth provider (library.js:32)');
  } else if (!constants.type || (constants.type !== 'oauth' && constants.type !== 'oauth2')) {
    winston.error('[sso-metry] Please specify an OAuth strategy to utilise (library.js:31)');
  } else if (!constants.userRoute) {
    winston.error('[sso-metry] User Route required (library.js:31)');
  } else {
    configOk = true;
  }


  function defaultGdprKey(callback) {
		async.waterfall([
			function(next) {
				meta.settings.get("sso-metry", next);
			},
      function(settings, next) {
        if(Object.keys(settings).indexOf(gdprKey) != -1) {
        	return next();
				}

        var toSet = {};
        toSet[gdprKey] = false;
        meta.settings.set("sso-metry", toSet, next);
      }
		], callback
		);
  }

  OAuth.init = function(params, callback) {
		var app = params.app;
		var router = params.router;
		var hostMiddleware = params.middleware;
		var hostControllers = params.controllers;

		router.get('/admin/plugins/sso-metry', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
		router.get('/api/admin/plugins/sso-metry', controllers.renderAdminPage);

		defaultGdprKey(function(err) {
      if(err) {
        winston.warn(err);
      }
      winston.info("Set up plugin sso metry!")

      callback();
    });
	};

  OAuth.getStrategy = function (strategies, callback) {
    if (configOk) {
      passportOAuth = require('passport-oauth')[constants.type === 'oauth' ? 'OAuthStrategy' : 'OAuth2Strategy'];

      if (constants.type === 'oauth') {
        // OAuth options
        opts = constants.oauth;
        opts.callbackURL = nconf.get('url') + '/auth/' + constants.name + '/callback';

        passportOAuth.Strategy.prototype.userProfile = function (token, secret, params, done) {
          this._oauth.get(constants.userRoute, token, secret, function (err, body, res) {
            if (err) {
              return done(new InternalOAuthError('failed to fetch user profile', err));
            }

            try {
              var json = JSON.parse(body);
              OAuth.parseUserReturn(json, function (err, profile) {
                if (err) return done(err);
                profile.provider = constants.name;

                done(null, profile);
              });
            } catch (e) {
              done(e);
            }
          });
        };
      } else if (constants.type === 'oauth2') {
        // OAuth 2 options
        opts = constants.oauth2;
        opts.callbackURL = nconf.get('url') + '/auth/' + constants.name + '/callback';

        passportOAuth.Strategy.prototype.userProfile = function (accessToken, done) {
          var self = this
          this._oauth2.get(constants.userRoute, accessToken, function (err, body, res) {
            if (err) {
              return done(new InternalOAuthError('failed to fetch user profile', err));
            }

            try {
              var json = JSON.parse(body);

              if (json.data.is_organization) {
                self._oauth2.get(constants.collaboratorRoute, accessToken, function (err, body, res) {
                  if (err) {
                    return done(new InternalOAuthError('failed to fetch user profile', err));
                  }

                  OAuth.parseUserReturn(JSON.parse(body), function (err, profile) {
                    if (err) return done(err);
                    profile.provider = constants.name;
                    done(null, profile);
                  });
                })
              } else {
                OAuth.parseUserReturn(json, function (err, profile) {
                  if (err) return done(err);
                  profile.provider = constants.name;
                  done(null, profile);
                });
              }
            } catch (e) {
              done(e);
            }
          });
        };
      }

      opts.passReqToCallback = true;

      passport.use(constants.name, new passportOAuth(opts, function (req, token, secret, profile, done) {
        OAuth.login({
          oAuthid: profile.id,
          handle: profile.displayName,
          email: profile.emails[0].value,
          isAdmin: profile.isAdmin
        }, function (err, user) {
          if (err) {
            return done(err);
          }

          authenticationController.onSuccessfulLogin(req, user.uid);
          done(null, user);
        });
      }));

      strategies.push({
        name: constants.name,
        url: '/auth/' + constants.name,
        callbackURL: '/auth/' + constants.name + '/callback',
        icon: 'fa-check-square',
        scope: (constants.scope || '').split(',')
      });

      callback(null, strategies);
    } else {
      callback(new Error('OAuth Configuration is invalid'));
    }
  };

  OAuth.parseUserReturn = function (body, callback) {
    // Alter this section to include whatever data is necessary
    // NodeBB *requires* the following: id, displayName, emails.
    // Everything else is optional.

    var profile = {};
    var email = (body.data.account || body.data).username;
    var name = (body.data.account || body.data).name || email;
    profile.id = body.data._id;
    profile.displayName = name;
    profile.emails = [{value: email}];

    // Do you want to automatically make somebody an admin? This line might help you do that...
    // profile.isAdmin = data.isAdmin ? true : false;

    callback(null, profile);
  }

  OAuth.login = function (payload, callback) {
    OAuth.getUidByOAuthid(payload.oAuthid, function (err, uid) {
      if (err) {
        return callback(err);
      }

      if (uid !== null) {
        // Existing User
        callback(null, {
          uid: uid
        });
      } else {
        // New User
        var success = function (uid) {
          // Save provider-specific information to the user
          User.setUserField(uid, constants.name + 'Id', payload.oAuthid);
          db.setObjectField(constants.name + 'Id:uid', payload.oAuthid, uid);

          if (payload.isAdmin) {
            Groups.join('administrators', uid, function (err) {
              callback(null, {
                uid: uid
              });
            });
          } else {
            callback(null, {
              uid: uid
            });
          }
        };

        User.getUidByEmail(payload.email, function (err, uid) {
          if (err) {
            return callback(err);
          }

          if (!uid) {
          	meta.settings.get("sso-metry", function(err, settings) {
          		if(err) {
          			winston.warn(err);
							}

          		var userCreateInfo = {
								username: payload.handle,
								email: payload.email
							};
          		if(settings["bypass-GDPR"] === 'on') { // I hate the on/off usage but ok... couldnt find the soruce code
          			userCreateInfo.gdpr_consent = true;
							}

							User.create(userCreateInfo, function (err, uid) {
								if (err) {
									return callback(err);
								}

								success(uid);
							});
						});
          } else {
            success(uid); // Existing account -- merge
          }
        });
      }
    });
  };

  OAuth.getUidByOAuthid = function (oAuthid, callback) {
    db.getObjectField(constants.name + 'Id:uid', oAuthid, function (err, uid) {
      if (err) {
        return callback(err);
      }
      callback(null, uid);
    });
  };

  OAuth.deleteUserData = function (data, callback) {
    async.waterfall([
      async.apply(User.getUserField, data.uid, constants.name + 'Id'),
      function (oAuthIdToDelete, next) {
        if(!oAuthIdToDelete){
          winston.warn("Got no oAuthIdToDelete.");
        }
        db.deleteObjectField(constants.name + 'Id:uid', oAuthIdToDelete, next);
      }
    ], function (err) {
      if (err) {
        winston.error('[sso-metry] Could not remove OAuthId data for uid ' + data.uid + '. Error: ' + err);
        return callback(err);
      }

      winston.verbose('[sso-metry] Removed OAuthId data for uid ' + data.uid + '.');

      callback(null, data);
    });
  };

  // If this filter is not there, the deleteUserData function will fail when getting the metryId for deletion.
  OAuth.whitelistFields = function(params, callback) {
    params.whitelist.push(constants.name + 'Id');
    callback(null, params);
  };

	OAuth.addAdminNavigation = function(header, callback) {
		header.plugins.push({
			route: '/plugins/sso-metry',
			icon: 'fa-tint',
			name: 'sso-metry'
		});

		callback(null, header);
	};

  module.exports = OAuth;
}(module));
