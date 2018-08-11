'use strict';
/* globals $, app, socket */

define('admin/plugins/sso-metry', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('sso-metry', $('.sso-metry-settings'));

		$('#save').on('click', function() {
			Settings.save('sso-metry', $('.sso-metry-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'sso-metry-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});