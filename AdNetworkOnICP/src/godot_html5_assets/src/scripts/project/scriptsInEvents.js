


const scriptsInEvents = {

	async EventSheet1_Event1_Act1(runtime, localVars)
	{
		self.createNewAd();
		
	},

	async EventSheet1_Event2_Act1(runtime, localVars)
	{
		self.fetchNextAd();
	},

	async EventSheet1_Event3_Act1(runtime, localVars)
	{
		self.topUpAdViews();
	},

	async EventSheet1_Event4_Act2(runtime, localVars)
	{
		self.handleImageSelection(runtime.globalVars.ChosenFileURL);
	},

	async EventSheet1_Event12_Act1(runtime, localVars)
	{
		self.initAdNetworkWithII();
		
	},

	async EventSheet1_Event13_Act1(runtime, localVars)
	{
		self.initAdNetworkWithPlug();
		
	},

	async EventSheet1_Event15_Act1(runtime, localVars)
	{
		self.registerProjectInCanister();
		
	},

	async EventSheet1_Event25_Act1(runtime, localVars)
	{
		self.checkTokenBalance();
	},

	async EventSheet1_Event26_Act1(runtime, localVars)
	{
		self.transferTokens();
	},

	async EventSheet1_Event27_Act1(runtime, localVars)
	{
		self.copyPrincipal();
	},

	async EventSheet1_Event28_Act1(runtime, localVars)
	{
		self.callTransferFromCanister();
		
	},

	async Previewevents_Event1_Act1(runtime, localVars)
	{
		self.cancelAdViewTimeout();
	},

	async Previewevents_Event11_Act1(runtime, localVars)
	{
		self.createNewAd();
	},

	async Loginevents_Event1_Act1(runtime, localVars)
	{
		self.initAdNetworkWithII();
		
	},

	async Loginevents_Event2_Act2(runtime, localVars)
	{
		self.initAdNetworkWithPlug();
		
	},

	async Loginevents_Event3_Act2(runtime, localVars)
	{
		self.initAdNetworkWithII();
		
	},

	async Loginevents_Event10_Act7(runtime, localVars)
	{
		self.fetchNextAd();
	},

	async Menuevents_Event1_Act1(runtime, localVars)
	{
		self.fetchTrackingData();
		
	},

	async Menuevents_Event2_Act1(runtime, localVars)
	{
		self.cancelAdViewTimeout();
	},

	async Menuevents_Event5_Act1(runtime, localVars)
	{
		self.copyPrincipal();
	},

	async Menuevents_Event8_Act1(runtime, localVars)
	{
		const adIdInput = runtime.globalVars.Input_AdID;
		const adId = parseInt(adIdInput, 10);
		if (!isNaN(adId)) {
		  self.fetchRemainingViewsForAd(adId);
		} else {
		  self.setStatusMessage("Please enter a valid numeric Ad ID.");
		}
		
	},

	async Menuevents_Event9_Act1(runtime, localVars)
	{
		const projectId = runtime.globalVars.Input_ProjectID.trim();
		if (projectId !== "") {
		  self.fetchTotalViewsForProject(projectId);
		} else {
		  self.setStatusMessage("Please enter a valid Project ID.");
		}
		
	},

	async Menuevents_Event15_Act2(runtime, localVars)
	{
		self.createNewAd();
	},

	async Menuevents_Event16_Act2(runtime, localVars)
	{
		self.logout();
	},

	async Menuevents_Event18_Act7(runtime, localVars)
	{
		self.fetchNextAd();
	},

	async Betaevents_Event1_Act1(runtime, localVars)
	{
		window.checkPassword();
		
	},

	async Betaevents_Event7_Act7(runtime, localVars)
	{
		self.fetchNextAd();
	},

	async Monetizeevents_Event1_Act1(runtime, localVars)
	{
		self.checkTokenBalance();
	},

	async Monetizeevents_Event5_Act2(runtime, localVars)
	{
		self.cashOutProjectViews(runtime.globalVars.projectId);
		
	},

	async Monetizeevents_Event6_Act2(runtime, localVars)
	{
		self.cashOutAllProjectsViews();
		
	},

	async Monetizeevents_Event9_Act1(runtime, localVars)
	{
		self.registerProjectInCanister();
		
	},

	async Monetizeevents_Event10_Act3(runtime, localVars)
	{
		self.registerProjectInCanister();
		
	},

	async Monetizeevents_Event11_Act3(runtime, localVars)
	{
		self.cashOutAllProjectsViews();
		
	},

	async Monetizeevents_Event13_Act7(runtime, localVars)
	{
		self.fetchNextAd();
	},

	async Advertiseevents_Event2_Act1(runtime, localVars)
	{
		self.checkTokenBalance();
	},

	async Advertiseevents_Event2_Act2(runtime, localVars)
	{
		self.fetchMyAds();
	},

	async Advertiseevents_Event3_Act1(runtime, localVars)
	{
		self.cancelAdViewTimeout();
	},

	async Advertiseevents_Event12_Act1(runtime, localVars)
	{
		self.deleteAd();
	},

	async Advertiseevents_Event29_Act1(runtime, localVars)
	{
		self.copyPrincipal();
	},

	async Advertiseevents_Event31_Act2(runtime, localVars)
	{
		self.handleImageSelection(runtime.globalVars.ChosenFileURL);
	},

	async Advertiseevents_Event42_Act2(runtime, localVars)
	{
		self.topUpAdViews();
	},

	async Advertiseevents_Event50_Act2(runtime, localVars)
	{
		self.handleImageSelection(runtime.globalVars.ChosenFileURL, 'Portrait');
	},

	async Advertiseevents_Event51_Act2(runtime, localVars)
	{
		self.handleImageSelection(runtime.globalVars.ChosenFileURL, 'Landscape');
	},

	async Advertiseevents_Event53_Act7(runtime, localVars)
	{
		self.fetchNextAd();
	},

	async Dashboardevents_Event1_Act1(runtime, localVars)
	{
		self.checkTokenBalance();
	},

	async Dashboardevents_Event2_Act1(runtime, localVars)
	{
		self.cancelAdViewTimeout();
	},

	async Dashboardevents_Event3_Act2(runtime, localVars)
	{
		self.topUpAdViews();
	},

	async Dashboardevents_Event5_Act2(runtime, localVars)
	{
		self.transferTokens();
	},

	async Dashboardevents_Event11_Act1(runtime, localVars)
	{
		self.copyPrincipal();
	},

	async Dashboardevents_Event14_Act1(runtime, localVars)
	{
		const adIdInput = runtime.globalVars.Input_AdID;
		const adId = parseInt(adIdInput, 10);
		if (!isNaN(adId)) {
		  self.fetchRemainingViewsForAd(adId);
		} else {
		  self.setStatusMessage("Please enter a valid numeric Ad ID.");
		}
		
	},

	async Dashboardevents_Event15_Act1(runtime, localVars)
	{
		const projectId = runtime.globalVars.Input_ProjectID.trim();
		if (projectId !== "") {
		  self.fetchTotalViewsForProject(projectId);
		} else {
		  self.setStatusMessage("Please enter a valid Project ID.");
		}
		
	},

	async Dashboardevents_Event20_Act1(runtime, localVars)
	{
		self.transferTokens();
	},

	async Dashboardevents_Event21_Act2(runtime, localVars)
	{
		self.callTransferFromCanister();
		
	},

	async Dashboardevents_Event22_Act4(runtime, localVars)
	{
		self.fetchNextAd();
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;

