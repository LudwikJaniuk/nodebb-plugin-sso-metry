<form role="form" class="sso-metry-settings">
	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">General</div>
		<div class="col-sm-10 col-xs-12">
			<p class="lead">
				Adjust these settings. You can then retrieve these settings in code via:
				<code>meta.settings.get('sso-metry', callback);</code>
			</p>
			<div class="form-group">
				<label for="bypass-GDPR">Bypass GDPR</label>
				<input type="checkbox" id="bypass-GDPR" name="bypass-GDPR" title="Bypass GDPR prompt on account create"
                    class="form-control">
			</div>
		</div>
		<p>Qwe value: {qwe}</p>
        <!-- BEGIN allcookies -->
        <p>cookie: {allcookies}</p>
        <!-- END allcookies -->

	</div>
</form>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>