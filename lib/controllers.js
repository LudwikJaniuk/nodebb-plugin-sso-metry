'use strict';

module.exports = function(meta) {
	var Controllers = {};

	Controllers.renderAdminPage = function (req, res, next) {
		/*
      Make sure the route matches your path to template exactly.

      If your route was:
        myforum.com/some/complex/route/
      your template should be:
        templates/some/complex/route.tpl
      and you would render it like so:
        res.render('some/complex/route');
    */

		var allcookies = [];
		for(var key in req.cookies) {
			if(!req.cookies.hasOwnProperty(key)) { continue; }
			allcookies.push(key + " -> " + req.cookies[key]);
		}

		meta.settings.get("sso-metry", function(err, set) {
			allcookies.push("setting: "  +Object.keys(set) + "|" + set["bypass-GDPR"]);
			res.render('admin/plugins/sso-metry', {qwe: Math.random(), allcookies: allcookies});
		});

	};

	return Controllers;
}
