/* globals predefProgress */

var configureController = null;

function getModelIdFromTr(tr) {
    return tr.attr('id').split('-')[1];
}

function getTrFromBtn(btn) {
    return btn.parent().parent().parent();
}

function getModelNameFromTr(tr) {
    return tr.find('.td-model-name').html();
}

function getModelIdFromBtn(btn) {
    var tr = getTrFromBtn(btn);
    return getModelIdFromTr(tr);
}

function fetchModelDetails(mid) {
    $.ajax('api/modelDetails', {
        dataType: 'json',
        method: 'GET',
        data: { modelId: mid },
        success: function (data) {
            $('#div-model-details-btns').addClass('hidden');

            $('#div-model-name').html(data.name);
            $('#span-creator').html(data.creator);
            $('#span-creation-date').html(formatDateTime(new Date(data.creationDate)));
            $('#span-dataset').html(data.dataset);

            if (data.isOnline) {
                $('#span-online-offline').addClass('green');
                $('#span-online-offline').html('online');

                if (data.isActive) {
                    $('#span-model-active-public').removeClass('red');
                    $('#span-model-active-public').addClass('green');
                    $('#span-model-active-public').html('active');
                } else {
                    $('#span-model-active-public').removeClass('green');
                    $('#span-model-active-public').addClass('red');
                    $('#span-model-active-public').html('inactive');
                }
            } else {
                $('#span-online-offline').removeClass('green');
                $('#span-online-offline').html('offline');

                $('#span-model-active-public').removeClass('red');
                $('#span-model-active-public').removeClass('green');

                if (data.isPublic) {
                    $('#span-model-active-public').html('public');
                } else {
                    $('#span-model-active-public').html('private');
                }
            }

            $('#input-model-details-desc').val(data.description);
            if (data.isOwner) {
                $('#input-model-details-desc').removeAttr('disabled');
            } else {
                $('#input-model-details-desc').attr('disabled', 'disabled');
            }

            $('#div-model-details').removeClass('hidden');
        },
        error: handleAjaxError()
    });
}

function selectRow(tr) {
    $('#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr').removeClass('success');
    tr.addClass('success');
}

function fetchDetails() {
    var tr = $(this);
    var mid = getModelIdFromTr(tr);
    fetchModelDetails(mid);
}

function onFetchDetails(event) {
    selectRow($(this));

    if (event.which == 1 || event.which == 3) {	// left or right button
        fetchDetails.call(this, event);
    }
}

function removeModel(mid, tr) {
    var name = tr != null ? getModelNameFromTr(tr) : mid;

    $.ajax('api/removeModel', {
        method: 'POST',
        dataType: 'json',
        data: { modelId: mid },
        success: function () {
            if (tr != null)
                tr.remove();
            showAlert($('#alert-holder'), $('#alert-wrapper-model-details'), 'alert-success', 'Model ' + name + ' removed!', null, true);
        },
        error: handleAjaxError()
    });
}

function viewModel(mid) {
    $.ajax('api/selectDataset', {
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ modelId: mid }),
        success: function () {
            redirectToUI();
        },
        error: handleAjaxError()
    });
}

function onViewModel() {
    var btn = $(this);
    var mid = getModelIdFromBtn(btn);

    viewModel(mid);

    return false;
}

function activate() {
    var btn = $(this);
    var tr = getTrFromBtn(btn);
    var mid = getModelIdFromTr(tr);
    var name = getModelNameFromTr(tr);

    promptConfirm('Activate Model', 'Are you sure you wish to activate model ' + name + '?', function () {
        $.ajax('api/activateModel', {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ modelId: mid, activate: true }),
            success: function () {
                tr.parent().remove(tr.attr('id'));
                $('#table-models-active').find('tbody').append(tr);

                tr.attr('id', 'active-' + mid);
                var newBtn = $('<button class="btn btn-danger btn-xs btn-deactivate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Deactivate</button>');
                var oldBtn = tr.find('.btn-activate');

                tr.find('.btn-activate').remove();
                tr.find('.span-btns').prepend(newBtn)

                newBtn.click(deactivate);

                if (tr.hasClass('success'))
                    fetchModelDetails(mid);
                if (oldBtn.hasClass('tbl-btn-offset'))
                    newBtn.addClass('tbl-btn-offset');
            },
            error: handleAjaxError()
        });
    });

    return false;
}

function deactivate() {
    var btn = $(this);
    var tr = getTrFromBtn(btn);
    var mid = getModelIdFromTr(tr);
    var name = getModelNameFromTr(tr);

    promptConfirm('Deactivate Model', 'Are you sure you wish to deactivate model ' + name + '?', function () {
        $.ajax('api/activateModel', {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ modelId: mid, activate: false }),
            success: function () {
                tr.parent().remove(tr.attr('id'));
                $('#table-models-inactive').find('tbody').append(tr);

                var newBtn = $('<button class="btn btn-success btn-xs btn-activate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Activate</button>');
                var oldBtn = tr.find('.btn-deactivate');

                tr.find('.btn-deactivate').remove();
                tr.find('.span-btns').prepend(newBtn);

                newBtn.click(activate);

                if (tr.hasClass('success'))
                    fetchModelDetails(mid);
                if (oldBtn.hasClass('tbl-btn-offset'))
                    newBtn.addClass('tbl-btn-offset');
            },
            error: handleAjaxError()
        });
    });

    return false;
}

function share() {
    var btn = $(this);
    var tr = getTrFromBtn(btn);
    var mid = getModelIdFromTr(tr);
    var name = getModelNameFromTr(tr);

    promptConfirm('Share Model', 'Are you sure you wish to share model ' + name + '?', function () {
        $.ajax('api/shareModel', {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ modelId: mid, share: true }),
            success: function () {
                tr.parent().remove(tr.attr('id'));
                $('#table-models-public').find('tbody').append(tr);

                var newBtn = $('<button class="btn btn-warning btn-xs btn-unshare" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Unshare</button>');
                var oldBtn = tr.find('.btn-share');

                tr.find('.btn-share').remove();
                tr.find('.span-btns').prepend(newBtn);

                newBtn.click(unshare);

                if (tr.hasClass('success'))
                    fetchModelDetails(mid);
                if (oldBtn.hasClass('tbl-btn-offset'))
                    newBtn.addClass('tbl-btn-offset');
            },
            error: handleAjaxError()
        });
    });

    return false;
}

function unshare() {
    var btn = $(this);
    var tr = getTrFromBtn(btn);
    var mid = getModelIdFromTr(tr);
    var name = getModelNameFromTr(tr);

    promptConfirm('Unshare Model', 'Are you sure you wish to unshare model ' + name + '?', function () {
        $.ajax('api/shareModel', {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ modelId: mid, share: false }),
            success: function () {
                tr.parent().remove(tr.attr('id'));
                $('#table-models-offline').find('tbody').append(tr);

                var newBtn = $('<button class="btn btn-default btn-xs btn-share" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Share</button>');
                var oldBtn = tr.find('.btn-unshare');

                tr.find('.btn-unshare').remove();
                tr.find('.span-btns').prepend(newBtn);

                newBtn.click(share);

                if (tr.hasClass('success'))
                    fetchModelDetails(mid);
                if (oldBtn.hasClass('tbl-btn-offset'))
                    newBtn.addClass('tbl-btn-offset');
            },
            error: handleAjaxError()
        });
    });

    return false;
}

(function () {
    //=======================================================
    // MODEL
    //=======================================================

    function ConfigureFormModel() {}

    ConfigureFormModel.prototype.uploadData = function (data, onProgress, done) {
        $.ajax(data.action, {
            contentType: false,
            enctype: data.enctype,
            data: data.formData,
            method: data.method,
            processData: false,
            xhr: function () {
                var myXhr = $.ajaxSettings.xhr();
                if (myXhr.upload) { // Check if upload property exists
                    myXhr.upload.addEventListener('progress', function (event) {
                        if (event.lengthComputable) {
                            var prog = 100*event.loaded / event.total;
                            onProgress(prog);
                        }
                    }, false); // For handling the progress of the upload
                }
                return myXhr;
            },
            success: function (data) {
                done(undefined, data);
            },
            error: function (xhr, status, err) {
                done(err);
            }
        })
    }

    //=======================================================
    // CONTROLLER
    //=======================================================

    function ConfigureFormController(opts) {
        if (opts.model == null) throw new Error('Model missing!');
        if (opts.view == null) throw new Error('View missing!');
        if (opts.done == null) throw new Error('Done callback missing!');

        var self = this;

        // form phases
        self._PHASE_UPLOAD_FILE = 1;
        self._PHASE_SELECT_ATTRIBUTES = 2;
        self._PHASE_CONFIGURE_TIME = 3;
        self._PHASE_CONFIGURE_ATTRS = 4;
        self._PHASE_FINAL = 5;

        // default values
        self._DEFAULT_TIME_UNIT = 'hour';
        self._DEFAULT_INCLUDE_TIME_FTRV = true;
        // clustering
        self._DEFAULT_CLUST_ALGORITHM = 'kmeans';
        self._DEFAULT_KMEANS_K = 12;
        self._DEFAULT_DPMEANS_MINSTATES = 10;
        self._DEFAULT_DPMEANS_MAXSTATES = 30;
        self._DEFAULT_DPMEANS_LAMBDA = 0.8;
        // hierarchy
        self._DEFAULT_HIERARCHY = 'aggClust';

        self._callbacks = {
            done: opts.done
        }

        self.model = opts.model;
        self.view = opts.view;

        // internal variables
        self.currPhase = self._PHASE_UPLOAD_FILE;

        // internal variables
        self.isRealTime = true;
        self.availableAttributes = null;
        self.guessedTypes = null;

        // output variables
        // phase 2
        self.selectedAttributes = [];
        // phase 3
        self.timeAttr = null;
        self.includeTimeFtrV = null;
        self.timeUnit = null;
        // phase 4
        self.attrTypeH = {};
        self.attrDiffH = {};
        // phase 5
        self.clustOpts = null;
        self.hierarchyType = null;
        self.controlAttrH = {};
        self.ignoredAttrH = {};
        self.modelName = null;
        self.modelDescription = null;

        self.registerHandlers();
    }

    ConfigureFormController.prototype.registerHandlers = function () {
        var self = this;

        var model = self.model;
        var view = self.view;

        var addViewHandler = function (event, handler) {
            view.on(event, function () {
                handler.apply(self, arguments);
            })
        }

        addViewHandler('fileRead', function (data) {
            self._setPhase(self._PHASE_UPLOAD_FILE);
            view.setUploadProgress(0);

            if (data == null) return;

            var onProgress = function (prog) {
                view.setUploadProgress(prog);
            }

            var done = function (e, data) {
                if (e != null) {
                    self._setAvailableAttrs(null, null);
                    return self._showError(e);
                }

                view.setUploadProgress(100);

                var fields = data.headers;
                var guessedTypes = (function () {
                    var guessedTypes = {};
                    for (var i = 0; i < data.types.length; i++) {
                        guessedTypes[fields[i].name] = data.types[i];
                    }
                    return guessedTypes;
                })();

                self._setAvailableAttrs(fields, guessedTypes);
            }

            model.uploadData(data, onProgress, done);
        })

        addViewHandler('attributesSelected', function (attrs) {
            self._setSelectedAttrs(attrs);
        })

        addViewHandler('timeUnitChanged', function (opts) {
            self._setTimeUnit(opts.value, false);
        })

        addViewHandler('includeTimeFeaturesChanged', function (opts) {
            self._setIncludeTimeFtrV(opts.value, false);
        })

        addViewHandler('timeAttrSelected', function (timeAttr) {
            self._setTimeAttr(timeAttr);
        })

        addViewHandler('attributeTypeChanged', function (opts) {
            var attr = opts.attr;
            var type = opts.type;
            self.attrTypeH[attr] = type;
        })

        addViewHandler('includeDerivChanged', function (opts) {
            if (opts.value) {
                self.attrDiffH[opts.attribute] = true;
            } else {
                delete self.attrDiffH[opts.attribute];
            }
        })

        addViewHandler('controlAttributesChanged', function (controlH) {
            self.controlAttrH = controlH;
            var availableAttrs = self._getConfigurableAttrs();
            for (var attr in controlH) {
                if (attr in self.ignoredAttrH) {
                    delete self.ignoredAttrH[attr];
                }
            }
            availableAttrs = availableAttrs.filter(function (val) {
                return !(val in controlH);
            })
            view.showSelectIgnoredAttrs(availableAttrs, self.ignoredAttrH);
        })

        addViewHandler('ignoredAttributesChanged', function (ignoredH) {
            self.ignoredAttrH = ignoredH;
            var availableAttrs = self._getConfigurableAttrs();
            for (var attr in ignoredH) {
                if (attr in self.controlAttrH) {
                    delete self.controlAttrH[attr];
                }
            }
            availableAttrs = availableAttrs.filter(function (val) {
                return !(val in ignoredH);
            })
            view.showSelectControlAttrs(availableAttrs, self.controlAttrH);
        })

        addViewHandler('clusteringParamChanged', function (opts) {
            if (opts.param == 'algorithm') {
                self._handleClustAlgChange(opts.value, false);
            } else {
                self.clustOpts[opts.param] = opts.value;
            }
        })

        addViewHandler('hierarchyTypeChanged', function (opts) {
            self._setHierarchyType(opts.value, false);
        })

        addViewHandler('modelNameChanged', function (name) {
            self._setModelName(name, false);
        })

        addViewHandler('modelDescriptionChanged', function (opts) {
            self._setModelDescription(opts.value, false);
        })

        addViewHandler('doneClicked', self._finish)
    }

    ConfigureFormController.prototype._handleClustAlgChange = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        var self = this;

        self.clustOpts = {};
        self._setClustering(value, refreshView);

        // set the values
        if (value == 'dpmeans') {
            self._setDpMeansMinStates(self._DEFAULT_DPMEANS_MINSTATES);
            self._setDpMeansMaxStates(self._DEFAULT_DPMEANS_MAXSTATES);
            self._setDpMeansLambda(self._DEFAULT_DPMEANS_LAMBDA);
        } else {
            self._setKMeansK(self._DEFAULT_KMEANS_K);
        }

        self.view.showKMeans(value == 'kmeans');
        self.view.showDpMeans(value == 'dpmeans');
    }

    // SET VALUES

    ConfigureFormController.prototype._resetUploadFile = function () {
        var self = this;
        self.view.setUploadProgress(0);
        self.view.setUploadFile(null);
    }

    ConfigureFormController.prototype._setAvailableAttrs = function (attrs, guessedTypes) {
        var self = this;

        // store the data
        self.availableAttributes = attrs;
        self.guessedTypes = guessedTypes;

        if (attrs != null) {
            self.view.showAvailableAttrs(attrs);
            self._setPhase(self._PHASE_SELECT_ATTRIBUTES);
        }
    }

    ConfigureFormController.prototype._setSelectedAttrs = function (attrs) {
        var self = this;

        if (attrs == null || attrs.length == 0) {
            self._setPhase(self._PHASE_SELECT_ATTRIBUTES);
            return;
        }

        self.selectedAttributes = attrs;
        // show configure time attribute
        self.view.showSelectTimeAttr(attrs);
        // set the default time unit
        self._setTimeUnit(self._DEFAULT_TIME_UNIT);
        // check configure time attributes
        self._setIncludeTimeFtrV(self._DEFAULT_INCLUDE_TIME_FTRV);

        // change the phase
        self._setPhase(self._PHASE_CONFIGURE_TIME);
    }

    ConfigureFormController.prototype._setTimeAttr = function (value) {
        var self = this;

        self.timeAttr = value;
        self.controlAttrH = {};
        self.ignoredAttrH = {};

        if (value == null) return;

        var configurableAttrs = self._getConfigurableAttrs();
        for (var i = 0; i < configurableAttrs.length; i++) {
            var attr = configurableAttrs[i];
            self.attrTypeH[attr] = self.guessedTypes[attr];
        }

        // show attributes for configuration
        self._setConfigurableAttrs(configurableAttrs, self.guessedTypes);
        // switch phase
        self._setPhase(self._PHASE_FINAL);
    }

    ConfigureFormController.prototype._setTimeUnit = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.timeUnit = value;
        if (refreshView) {
            this.view.setTimeUnit(value);
        }
    }

    ConfigureFormController.prototype._setIncludeTimeFtrV = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.includeTimeFtrV = value;
        if (refreshView) {
            this.view.setIncludeTimeFtrV(value);
        }
    }

    ConfigureFormController.prototype._setConfigurableAttrs = function (configurableAttrs,
            guessedTypes, refreshView) {
        var self = this;

        if (refreshView == null) refreshView = true;

        if (refreshView) {
            // show attribute types
            self.view.showSelectAttrTypes(configurableAttrs, self.guessedTypes);
            // show add change of attribute
            self.view.showConfigureDerivatives(configurableAttrs);
            // show select control attributes
            self.view.showSelectControlAttrs(configurableAttrs);
            // show select ignored attributes
            self.view.showSelectIgnoredAttrs(configurableAttrs);
        }
    }

    ConfigureFormController.prototype._setClustering = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.clustOpts.algorithm = value;
        if (refreshView) {
            this.view.setClusteringAlgorithm(value);
        }
    }

    ConfigureFormController.prototype._setDpMeansMinStates = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.clustOpts.minStates = value;
        if (refreshView) {
            this.view.setDpMeansMinStates(value);
        }
    }

    ConfigureFormController.prototype._setDpMeansMaxStates = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.clustOpts.maxStates = value;
        if (refreshView) {
            this.view.setDpMeansMaxStates(value);
        }
    }

    ConfigureFormController.prototype._setDpMeansLambda = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.clustOpts.lambda = value;
        if (refreshView) {
            this.view.setDpMeansLambda(value);
        }
    }

    ConfigureFormController.prototype._setKMeansK = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.clustOpts.k = value;
        if (refreshView) {
            this.view.setKMeansK(value);
        }
    }

    ConfigureFormController.prototype._setDpMeansMinStates = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.clustOpts.minStates = value;
        if (refreshView) {
            this.view.setDpMeansMinStates(value);
        }
    }

    ConfigureFormController.prototype._setHierarchyType = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.hierarchyType = value;
        if (refreshView) {
            this.view.setHierarchyType(value);
        }
    }

    ConfigureFormController.prototype._setModelName = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        var self = this;

        self.modelName = value;

        if (refreshView) {
            self.view.setModelName(value);
        }

        // check if all the configuration is present
        self._checkEnableDone();
    }

    ConfigureFormController.prototype._setModelDescription = function (value, refreshView) {
        if (refreshView == null) refreshView = true;

        this.modelDescription = value;
        if (refreshView) {
            this.view.setModelDescription(value);
        }

        // check if all the configuration is present
        this._checkEnableDone();
    }

    //==================================

    ConfigureFormController.prototype._resetVals = function () {
        var self = this;
        self._resetUploadFile();
        self._setPhase(self._PHASE_UPLOAD_FILE);
    }

    ConfigureFormController.prototype.setIsRealTime = function (isRealTime) {
        this.isRealTime = isRealTime;
    }

    ConfigureFormController.prototype.show = function (show) {
        var self = this;
        if (show) {
            self._resetVals();
        }
        self.view.show(show);
    }

    ConfigureFormController.prototype._checkValuesPresent = function () {
        var self = this;
        // phase 1 is implicit
        // phase 2
        if (self.selectedAttributes == null || self.selectedAttributes.length == 0)
            return false;
        // phase 3
        if (self.timeAttr == null || self.timeUnit == null)
            return false;
        // phase 4
        if (self.attrTypeH == null || Object.keys(self.attrTypeH).length == 0)
            return false;
        if (self.modelName == null || self.modelName == '')
            return false;
        if (self.hierarchyType == null)
            return false;

        // check the clustering
        if (self.clustOpts == null || self.clustOpts.algorithm == null)
            return false;
        if (self.clustOpts.algorithm == 'kmeans') {
            var k = self.clustOpts.k;
            if (!isInt(k)) return false;
        } else if (self.clustOpts.algorithm == 'dpmeans') {
            var maxStates = self.clustOpts.maxStates;
            var minStates = self.clustOpts.minStates;
            var lambda = self.clustOpts.lambda;

            if (minStates != null && minStates != '' && isNaN(minStates)) return false;
            if (maxStates != null && maxStates != '' && isNaN(maxStates)) return false;
            if (isNaN(lambda)) return false;
        } else {
            return false;
        }

        return true;
    }

    ConfigureFormController.prototype._checkEnableDone = function () {
        this.view.enableDone(this._checkValuesPresent());
    }

    ConfigureFormController.prototype._finish = function () {
        var self = this;

        if (!self._checkValuesPresent()) {
            console.warn('Dataset configuration not complete!');
            return
        }

        var attrs = (function () {
            var attrs = [];
            for (var i = 0; i < self.selectedAttributes.length; i++) {
                var attr = self.selectedAttributes[i];
                var type = attr == self.timeAttr ? 'time' : self.attrTypeH[attr];
                attrs.push({
                    name: attr.replace('&quot;', '"'),
                    type: type
                })
            }
            return attrs;
        })();

        var controlAttrs = (function () {
            var controlAttrs = [];
            for (var attr in self.controlAttrH) {
                var type = attr == self.timeAttr ? 'time' : self.attrTypeH[attr];
                controlAttrs.push({
                    name: attr,
                    type: type
                })
            }
            return controlAttrs;
        })();

        var ignoredAttrs = (function () {
            var ignoredAttrs = [];
            for (var attr in self.ignoredAttrH) {
                var type = attr == self.timeAttr ? 'time' : self.attrTypeH[attr];
                ignoredAttrs.push({
                    name: attr,
                    type: type
                })
            }
            return ignoredAttrs;
        })();

        var includeDerivAttrs = (function () {
            var result = [];
            for (var attr in self.attrDiffH) {
                var type = attr == self.timeAttr ? 'time' : self.attrTypeH[attr];
                result.push({
                    name: attr,
                    type: type
                });
            }
            return result;
        })();

        var clustData = (function () {
            if (self.clustOpts.algorithm == 'kmeans') {
                return {
                    type: 'kmeans',
                    k: self.clustOpts.k,
                    includeTimeFeatures: self.includeTimeFtrV,
                }
            } else {
                var result = {
                    type: 'dpmeans',
                    lambda: self.clustOpts.lambda,
                    includeTimeFeatures: self.includeTimeFtrV,
                }

                var minStates = self.clustOpts.minStates;
                var maxStates = self.clustOpts.maxStates;

                if (minStates != null && minStates != '')
                    result.minStates = minStates;
                if (maxStates != null && maxStates != '')
                    result.maxStates = maxStates;

                return result;
            }
        })();

        var data = {
            time: self.timeAttr,
            timeUnit: self.timeUnit,
            attrs: attrs,
            controlAttrs: controlAttrs,
            ignoredAttrs: ignoredAttrs,
            derivAttrs: includeDerivAttrs,
            hierarchyType: self.hierarchyType,
            isRealTime: self.isRealTime,
            name: self.modelName,
            description: self.modelDescription,
            clust: clustData
        }

        self._callbacks.done(undefined, data);
    }

    ConfigureFormController.prototype._getConfigurableAttrs = function () {
        var self = this;
        var configurableAttrs = [];
        for (var i = 0; i < self.selectedAttributes.length; i++) {
            var attr = self.selectedAttributes[i];
            if (attr != self.timeAttr) {
                configurableAttrs.push(attr);
            }
        }
        return configurableAttrs;
    }

    ConfigureFormController.prototype._setPhase = function (phase) {
        var self = this;

        if (phase == self.currPhase) { return; }

        switch (phase) {
            case self._PHASE_UPLOAD_FILE: {
                self._setAvailableAttrs(null, null);
                // show appropriate phases
                this.view.showPhaseSelectAttr(false);
                this.view.showPhaseConfigureTime(false);
                this.view.showPhaseConfigureAttrs(false);
                this.view.showPhaseFinal(false);
                break;
            }
            case self._PHASE_SELECT_ATTRIBUTES: {
                // show appropriate phases
                this.view.showPhaseSelectAttr(true);
                this.view.showPhaseConfigureTime(false);
                this.view.showPhaseConfigureAttrs(false);
                this.view.showPhaseFinal(false);
                break;
            }
            case self._PHASE_CONFIGURE_TIME: {
                self._setTimeAttr(null);
                // show appropriate phases
                this.view.showPhaseSelectAttr(true);
                this.view.showPhaseConfigureTime(true);
                this.view.showPhaseConfigureAttrs(false);
                this.view.showPhaseFinal(false);
                break;
            }
            case self._PHASE_CONFIGURE_ATTRS: {
                // show appropriate phases
                this.view.showPhaseSelectAttr(true);
                this.view.showPhaseConfigureTime(true);
                this.view.showPhaseConfigureAttrs(true);
                this.view.showPhaseFinal(false);
                break;
            }
            case self._PHASE_FINAL: {
                self._handleClustAlgChange(self._DEFAULT_CLUST_ALGORITHM);
                self._setHierarchyType(self._DEFAULT_HIERARCHY);
                self._setModelName(null);
                self._setModelDescription(null);
                // show appropriate phases
                this.view.showPhaseSelectAttr(true);
                this.view.showPhaseConfigureTime(true);
                this.view.showPhaseConfigureAttrs(true);
                this.view.showPhaseFinal(true);
                break;
            }
            default:
                throw new Error('Unknown form phase: ' + phase);
        }

        self.currPhase = phase;
    }

    ConfigureFormController.prototype._showError = function (err) {
        var msg = typeof err == 'string' ? err : err.message;
        this.view.showAlert(msg);
    }

    //=======================================================
    // VIEW
    //=======================================================

    function ConfigureFormView() {
        var self = this;

        self._callbacks = {
            fileRead: [],
            attributesSelected: [],
            timeAttrSelected: [],
            includeDerivChanged: [],
            timeUnitChanged: [],
            includeTimeFeaturesChanged: [],
            attributeTypeChanged: [],
            clusteringParamChanged: [],
            hierarchyTypeChanged: [],
            controlAttributesChanged: [],
            ignoredAttributesChanged: [],
            modelNameChanged: [],
            modelDescriptionChanged: [],
            doneClicked: []
        }

        self._fireEvents = true;

        self.initHandlers();
    }

    ConfigureFormView.prototype.initHandlers = function () {
        var self = this;

        var handleChange = function (input, event, key, transform) {
            if (transform == null) transform = function (val) { return val; }

            input.change(function () {
                var val = $(this).val();
                if (val == null || val == '') {
                    self.fire(event, { param: key, value: null });
                } else {
                    self.fire(event, { param: key, value: transform(val) });
                }
            })
        }

        var handleClustChange = function (input, key, transform) {
            handleChange(input, 'clusteringParamChanged', key, transform);
        }

        $('#input-choose-upload').change(function () {
            var hasData = $('#input-choose-upload').val() != '';

            if (!hasData) {
                self.fire('fileRead', null);
                return;
            }

            var form = $('#form-upload');

            var data = {
                formData: new FormData(form[0]),
                action: form.attr('action'),
                enctype: form.attr('enctype'),
                method: form.attr('method')
            }

            self.fire('fileRead', data);
        });

        handleChange($('#select-tu'), 'timeUnitChanged', 'timeUnit');

        $('#chk-include-time-ftrv').change(function () {
            var val = $(this).is(':checked');
            self.fire('includeTimeFeaturesChanged', { param: 'includeTimeFeatures', value: val });
        })

        // clustering parameters
        handleClustChange($('#select-clust'), 'algorithm');
        handleClustChange($('#input-kmeans-k'), 'k', parseInt);
        handleClustChange($('#input-dpmeans-minstates'), 'minStates', parseInt);
        handleClustChange($('#input-dpmeans-maxstates'), 'maxStates', parseInt);
        handleClustChange($('#input-dpmeans-lambda'), 'lambda', parseFloat);

        // hierarchy type
        handleChange($('#select-hierarchy'), 'hierarchyTypeChanged', 'type');

        $('#input-model-name').keyup(function () {
            var val = $('#input-model-name').val();
            if (val == '') val = null;
            self.fire('modelNameChanged', val);
        });

        // description
        handleChange($('#input-model-desc'), 'modelDescriptionChanged', 'description');

        $('#btn-done').click(function () {
            self.fire('doneClicked');
        });
    }

    // SET VALUE

    ConfigureFormView.prototype.setUploadFile = function (value) {
        this._setTextValue($('#input-choose-upload'), value);
    }

    ConfigureFormView.prototype.setTimeUnit = function (value) {
        this._setSelectValue($('#select-tu'), value);
    }

    ConfigureFormView.prototype.setIncludeTimeFtrV = function (value) {
        this._setCheckValue($('#chk-include-time-ftrv'), value);
    }

    ConfigureFormView.prototype.setClusteringAlgorithm = function (value) {
        this._setSelectValue($('#select-clust'), value);
    }

    ConfigureFormView.prototype.setDpMeansMinStates = function (value) {
        this._setTextValue($('#input-dpmeans-minstates'), value);
    }

    ConfigureFormView.prototype.setDpMeansMaxStates = function (value) {
        this._setTextValue($('#input-dpmeans-maxstates'), value);
    }

    ConfigureFormView.prototype.setDpMeansLambda = function (value) {
        this._setTextValue($('#input-dpmeans-lambda'), value);
    }

    ConfigureFormView.prototype.setKMeansK = function (value) {
        this._setTextValue($('#input-kmeans-k'), value);
    }

    ConfigureFormView.prototype.setHierarchyType = function (value) {
        this._setSelectValue($('#select-hierarchy'), value);
    }

    ConfigureFormView.prototype.setModelName = function (value) {
        this._setTextValue($('#input-model-name'), value);
    }

    ConfigureFormView.prototype.setModelDescription = function (value) {
        this._setTextValue($('#input-model-desc'), value);
    }


    ConfigureFormView.prototype._setTextValue = function (input, value) {
        var self = this;
        self._fireEvents = false;
        input.val(value != null ? value : '');
        self._fireEvents = true;
    }

    ConfigureFormView.prototype._setSelectValue = function (input, value) {
        var self = this;
        self._fireEvents = false;
        input.val(value);
        self._fireEvents = true;
    }

    ConfigureFormView.prototype._setCheckValue = function (input, checked) {
        var self = this;
        self._fireEvents = false;
        input.prop('checked', checked);
        self._fireEvents = true;
    }

    // RENDERING

    ConfigureFormView.prototype.showAvailableAttrs = function (fields) {
        var self = this;

        var select = $('#select-attrs');
        // clear the attributes
        select.html('');

        if (fields == null || fields.length == 0) return;

        for (var i = 0; i < fields.length; i++) {
            var attr = fields[i].name;
            select.append('<option value="' + attr.replace(/\"/g, '&quot;') + '">' + attr + '</option>');
        }
        select.bootstrapDualListbox({
            showFilterInputs: true,
            selectedListLabel: 'Selected Attributes',
            nonSelectedListLabel: 'Ignored Attributes'
        });
        select.bootstrapDualListbox('refresh');

        select.change(function () {
            var data = select.val();
            self.fire('attributesSelected', data);
        })
    }

    ConfigureFormView.prototype.showSelectTimeAttr = function (selectedAttrs) {
        var self = this;

        var timeRadio = $('#radio-time');
        timeRadio.html('');	// clear the element

        for (var i = 0; i < selectedAttrs.length; i++) {
            var div = $('<div class="radio" />')
            var label = $('<label />');
            var input = $('<input />');

            input.attr('type', 'radio');
            input.attr('name', 'attr-time');
            input.val(selectedAttrs[i]);

            label.append(input);
            label.append(selectedAttrs[i]);
            div.append(label);
            timeRadio.append(div);
        }

        timeRadio.find('input:radio').change(function () {
            var timeAttr = $(this).val();
            self.fire('timeAttrSelected', timeAttr);
        });
    }

    ConfigureFormView.prototype.showSelectAttrTypes = function (attributes, predefTypes) {
        var self = this;

        var typeDiv = $('#div-select-attr-types');
        typeDiv.html('');
        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];
            var type = predefTypes[attr];

            var div = $('<div style="height: 27px;" />');
            var inputSpan = $('<span class="pull-right" style="clear: both;" />');

            var numLabel = $('<label>Numeric: </label>');
            var nomLabel = $('<label>Categorical: </label>');
            var inputNum = $('<input type="radio" value="numeric" />');
            var inputNom = $('<input type="radio" value="nominal" />');

            inputNum.attr('id', 'radio-type-num-' + i);
            inputNom.attr('id', 'radio-type-cat-' + i);
            inputNum.attr('name', 'radio-type-' + i);
            inputNom.attr('name', 'radio-type-' + i);

            numLabel.attr('for', 'radio-type-num-' + i);
            nomLabel.attr('for', 'radio-type-cat-' + i);

            if (type == 'numeric') {
                inputNum.attr('checked', 'checked');
            } else if (type == 'categorical') {
                inputNom.attr('checked', 'checked');
            }

            inputSpan.append(numLabel);
            inputSpan.append(inputNum);
            inputSpan.append('&nbsp;');
            inputSpan.append(nomLabel);
            inputSpan.append(inputNom);

            div.html(attr);
            div.append(inputSpan);

            typeDiv.append(div);
        }

        typeDiv.find('input:radio').change(function () {
            var el = $(this);
            var parent = el.parent();
            var checkedEl = parent.find('input[type=radio]:checked');
            var checkedElId = checkedEl.attr('id');
            var idx = parseInt(checkedElId.substring(checkedElId.lastIndexOf('-')+1));
            var attr = attributes[idx];
            var type = checkedEl.val();
            self.fire('attributeTypeChanged', { attr: attr, type: type });
        });
    }

    ConfigureFormView.prototype.showConfigureDerivatives = function (attributes) {
        var self = this;

        var container = $('#div-select-add-deriv');
        container.html('');
        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];

            var div = $('<div class="checkbox">' + attr + '</div>');
            var input = $('<span class="pull-right"><input type="checkbox" id="chk-add-deriv-' + i + '" /></span>');

            div.append(input);
            container.append(div);
        }

        container.find('input').change(function () {
            var chk = $(this);
            var id = chk.attr('id');
            id = parseInt(id.substring(id.lastIndexOf('-')+1));

            var attr = attributes[id];
            var val = chk.is(':checked');
            self.fire('includeDerivChanged', { attribute: attr, value: val });
        })
    }

    ConfigureFormView.prototype.showSelectControlAttrs = function (selectedAttrs, selected) {
        var self = this;

        if (selected == null) selected = {};

        var selectControls = $('#select-controls');
        selectControls.html('');
        for (var i = 0; i < selectedAttrs.length; i++) {
            var attr = selectedAttrs[i];
            var option = $('<option value="' + attr.replace(/\"/g, '&quot;') + '">' + attr + '</option>');
            if (attr in selected) {
                option.attr('selected', 'selected');
            }
            selectControls.append(option);
        }

        selectControls.bootstrapDualListbox({
            showFilterInputs: false,
            nonSelectedListLabel: 'State Attributes',
            selectedListLabel: 'Transition Atrtibutes'
        });

        selectControls.off('change');
        selectControls.change(function () {
            var controlV = selectControls.val();
            if (controlV == null) { controlV = []; }

            var controlH = (function () {
                var controlH = {};
                for (var i = 0; i < controlV.length; i++) {
                    controlH[controlV[i]] = true;
                }
                return controlH
            })();

            self.fire('controlAttributesChanged', controlH);
        });

        selectControls.bootstrapDualListbox('refresh');
    }

    ConfigureFormView.prototype.showSelectIgnoredAttrs = function (selectedAttrs, selected) {
        var self = this;

        if (selected == null) selected = {};

        var selectIgnored = $('#select-ignored');
        selectIgnored.html('');
        for (var i = 0; i < selectedAttrs.length; i++) {
            var attr = selectedAttrs[i];
            var option = $('<option value="' + attr.replace(/\"/g, '&quot;') + '">' + attr + '</option>');
            if (attr in selected) {
                option.attr('selected', 'selected');
            }
            selectIgnored.append(option);
        }

        selectIgnored.bootstrapDualListbox({
            showFilterInputs: false,
            nonSelectedListLabel: 'State Attributes',
            selectedListLabel: 'Ignored Atrtibutes'
        });

        selectIgnored.off('change');
        selectIgnored.change(function () {
            var ignoredV = selectIgnored.val();
            if (ignoredV == null) { ignoredV = []; }

            var ignoredH = (function () {
                var ignoredH = {};
                for (var i = 0; i < ignoredV.length; i++) {
                    ignoredH[ignoredV[i]] = true;
                }
                return ignoredH;
            })();

            self.fire('ignoredAttributesChanged', ignoredH);
        })

        selectIgnored.bootstrapDualListbox('refresh');
    }

    ConfigureFormView.prototype.showKMeans = function (show) {
        if (show) {
            $('#div-config-kmeans').removeClass('hidden');
        } else {
            $('#div-config-kmeans').addClass('hidden');
        }
    }

    ConfigureFormView.prototype.showDpMeans = function (show) {
        if (show) {
            $('#div-config-dpmeans').removeClass('hidden');
        } else {
            $('#div-config-dpmeans').addClass('hidden');
        }
    }

    ConfigureFormView.prototype.setUploadProgress = function (progress) {
        var progStr = progress.toFixed();
        $('#progress-file-upload').css('width', progStr + '%');
        $('#progress-file-upload').html(progStr + '%');
    }

    ConfigureFormView.prototype.enableDone = function (enable) {
        if (enable) {
            $('#btn-done').removeAttr('disabled');
        } else {
            $('#btn-done').attr('disabled', 'disabled');
        }
    }

    // PHASES

    ConfigureFormView.prototype.showPhaseSelectAttr = function (show) {
        this._showElement($('#form-phase-select-attrs'), show);
    }
    ConfigureFormView.prototype.showPhaseConfigureTime = function (show) {
        this._showElement($('#form-phase-configure-time'), show);
    }
    ConfigureFormView.prototype.showPhaseConfigureAttrs = function (show) {
        this._showElement($('#form-phase-configure-attrs'), show);
    }
    ConfigureFormView.prototype.showPhaseFinal = function (show) {
        this._showElement($('#form-phase-configure-alg'), show);
    }

    ConfigureFormView.prototype.showAlert = function (msg) {
        showAlert($('#alert-holder'), $('#alert-wrapper-create-model'), 'alert-danger', msg, null, true);
    }

    // SHOW / HIDE

    ConfigureFormView.prototype._showElement = function (el, show) {
        if (show == null) { show = true; }
        if (show) {
            el.show();
        } else {
            el.hide();
        }
    }

    ConfigureFormView.prototype.show = function (show) {
        if (show) {
            $('#popup-data-upload').modal('show');
        } else {
            $('#popup-data-upload').modal('hide');
        }
    }

    // EVENTS

    ConfigureFormView.prototype.on = function (event, handler) {
        var self = this;
        if (!(event in self._callbacks)) throw new Error('Invalid event: ' + event);
        self._callbacks[event].push(handler);
    }

    ConfigureFormView.prototype.fire = function (event, data) {
        var self = this;

        if (!(event in self._callbacks)) throw new Error('Invalid event: ' + event);
        if (!self._fireEvents) return;

        var handlers = self._callbacks[event];
        for (var i = 0; i < handlers.length; i++) {
            handlers[i](data);
        }
    }

    //===================================================
    // DASHBOARD MODEL
    //===================================================

    function DashboardModel() {}

    DashboardModel.prototype.constructModel = function (data, onProgress, done) {
        var self = this;
        $.ajax('api/buildModel', {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            timeout: 1000*60*60*24,	// 1 day
            success: function () {
                $('#progress-build-model').css('background-color', ''); // TODO move this somewhere
                self.pingProgress(onProgress, done);
            },
            error: handleAjaxError(null, done)
        });
    }

    DashboardModel.prototype.pingProgress = function (onProgress, done) {
        var self = this;

        $.ajax('api/pingProgress', {
            method: 'GET',
            contentType: 'application/json',
            success: function (data, status, xhr) {
                if (xhr.status == 204) {	// no content
                    self.pingProgress(onProgress, done);
                    return;
                }

                onProgress(data.progress, data.message);

                if (data.error != null) {
                    done(data.error);
                } else {
                    if (!data.isFinished) {
                        self.pingProgress(onProgress, done);
                    } else {	// finished
                        done(undefined, data);
                    }
                }
            },
            error: handleAjaxError(null, function () {
                $('#div-model-progress').addClass('hidden');
            })
        });
    }


    $(document).ready(function () {
        var dashboardModel = new DashboardModel();
        var configModel = new ConfigureFormModel();
        var configView = new ConfigureFormView();

        var onModelProgress = function (prog, msg) {
            $('#progress-build-model').css('width', prog + '%');
            $('#progress-build-model').html(msg);
        }

        var onModelDone = function (e, data) {
            $('#btn-add-online,#btn-add-offline').removeAttr('disabled', 'disabled');

            if (e != null) {
                console.error('Received result with error! Highlighting ...');
                console.error(e);
                $('#progress-build-model').css('background-color', 'red');
                return;
            }

            var mid = data.mid;
            var isRealTime = data.isRealTime;   // TODO move this somewhere!!

            // fetch the new model
            $.ajax('api/modelDetails', {
                dataType: 'json',
                method: 'GET',
                data: { modelId: mid },
                success: function (data) {
                    var table = isRealTime ? $('#table-models-active') : $('#table-models-offline');

                    var tr = $('<tr />');
                    tr.attr('id', (isRealTime ? 'active-' : 'offline-') + data.mid);
                    tr.addClass('ui-sortable-handle');
                    tr.mousedown(onFetchDetails);

                    var nameTd = $('<td />');
                    var dateTd = $('<td />');
                    var buttonsTd = $('<td />');

                    nameTd.addClass('td-model-name');
                    nameTd.html(data.name);

                    dateTd.addClass('td-model-date');
                    dateTd.html(formatDate(new Date(data.creationDate)));

                    buttonsTd.addClass('td-btns');

                    tr.append(nameTd);
                    tr.append(dateTd);
                    tr.append(buttonsTd);

                    // initialize the buttons
                    var buttonSpan = $('<span class="pull-right span-btns" />');

                    var btnView = $('<button class="btn btn-info btn-xs btn-view" aria-label="Left Align"><span class="glyphicon glyphicon-eye-open"></span> View</button>');
                    btnView.click(onViewModel);

                    buttonSpan.append(btnView);
                    buttonsTd.append(buttonSpan);

                    if (isRealTime) {
                        var deactivateBtn = $('<button class="btn btn-danger btn-xs btn-deactivate tbl-btn-offset" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Deactivate</button>');
                        deactivateBtn.click(deactivate);
                        buttonSpan.prepend(deactivateBtn);
                    } else {
                        var shareBtn = $('<button class="btn btn-default btn-xs btn-share tbl-btn-offset" aria-label="Left Align" style="margin-right: 4px;"><span class="glyphicon glyphicon-globe"></span> Share</button>');
                        shareBtn.click(share);
                        buttonSpan.prepend(shareBtn);
                    }

                    table.find('tbody').append(tr);

                    setTimeout(function () {
                        $('#div-model-progress').addClass('hidden');
                        $('#progress-build-model').css('width', '0%');
                    }, 5000);
                },
                error: handleAjaxError()
            });
        }

        var onConfig = function (e, data) {
            configureController.show(false);

            if (e != null) {
                var msg = typeof e == 'string' ? e : e.message;
                showAlert($('#alert-holder'), $('#alert-wrapper-main'), 'alert-danger', msg, null, true);
                return;
            }

            $('#div-model-progress').removeClass('hidden');

            var isRealTime = data.isRealTime;

            dashboardModel.constructModel(data, onModelProgress, function (e, data) {
                if (data != null) {
                    data.isRealTime = isRealTime;
                }
                onModelDone(e, data);
            });
        }

        configureController = new ConfigureFormController({
            model: configModel,
            view: configView,
            done: onConfig,
        })

        $('#btn-add-online').click(function () {
            configureController.setIsRealTime(true);
            configureController.show(true);
        });

        $('#btn-add-offline').click(function () {
            configureController.setIsRealTime(false);
            configureController.show(true);
        });

        if (predefProgress != null && !predefProgress.isFinished) {
            $('#div-model-progress').removeClass('hidden');
            $('#progress-build-model').css('width', predefProgress.progress + '%');
            $('#progress-build-model').html(predefProgress.message);
            dashboardModel.pingProgress(onModelProgress, function (e, data) {
                if (data != null) {
                    data.isRealTime = predefProgress.isRealTime;
                }
                onModelDone(e, data);
            });
            $('#btn-add-online,#btn-add-offline').attr('disabled', 'disabled');
        }
    })
})();

(function () {

    //========================================================
    // TABLES
    //========================================================

    $('#table-models-active tbody,#table-models-inactive tbody,#table-models-offline tbody,#table-models-public tbody').sortable({
        helper: function(e, tr) {
            var $originals = tr.children();
            var $helper = tr.clone();
            $helper.children().each(function(index) {
                $(this).width($originals.eq(index).width())
            });
            return $helper;
        }
    });

    (function () {
        var tableRowsSelector = '#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr';
        var tableRows = $(tableRowsSelector);

        tableRows.mousedown(onFetchDetails);

        $.contextMenu({
            selector: tableRowsSelector,
            items: {
                view: {
                    name: 'View',
                    callback: function () {
                        var tr = $(this);
                        var mid = getModelIdFromTr(tr);
                        viewModel(mid);
                    }
                },
                remove: {
                    name: 'Remove',
                    callback: function () {
                        var tr = $(this);
                        var mid = getModelIdFromTr(tr);
                        var name = getModelNameFromTr(tr);

                        promptConfirm('Remove Model', 'Are you sure you wish to remove model ' + name + '?', function () {
                            removeModel(mid, tr);
                        });
                    }
                }
            }
        });
    })();

    //========================================================
    // BUTTONS ON THE DASHBOARD
    //========================================================

    $('.btn-view').click(onViewModel);

    // table buttons
    $('.btn-activate').click(activate);
    $('.btn-deactivate').click(deactivate);
    $('.btn-share').click(share);
    $('.btn-unshare').click(unshare);

    //========================================================
    // MODEL DETAILS
    //========================================================

    $('#input-model-details-desc').keyup(function () {
        $('#div-model-details-btns').removeClass('hidden');
    });

    $('#btn-save-model-details').click(function () {
        var tr = $('#table-models-offline,#table-models-public,#table-models-active,#table-models-inactive').find('.success');
        var mid = getModelIdFromTr(tr);
        var desc = $('#input-model-details-desc').val();

        $.ajax('api/modelDescription', {
            dataType: 'json',
            data: { modelId: mid, description: desc },
            method: 'POST',
            success: function () {
                $('#div-model-details-btns').addClass('hidden');
                showAlert($('#alert-holder'), $('#alert-wrapper-model-details'), 'alert-success', 'Details saved!', null, true);
            },
            error: handleAjaxError($('#alert-wrapper-model-details'))
        });
    });

    $('#btn-cancel-model-details').click(function () {
        var tr = $('#table-models-offline,#table-models-public,#table-models-active,#table-models-inactive').find('.success');
        var mid = getModelIdFromTr(tr);

        fetchModelDetails(mid);
    });

    //========================================================
    // USE CASE CONFIGURATION
    //========================================================

    (function () {
        var calcCoeffDiv = $('#div-configure-coeff');

        function fetchConfig() {
            $.ajax('api/config', {
                dataType: 'json',
                method: 'GET',
                data: { properties: [
                    'calc_coeff',
                    'deviation_extreme_lambda',
                    'deviation_major_lambda',
                    'deviation_minor_lambda',
                    'deviation_significant_lambda'
                ] },
                success: function (data) {
                    var props = {};
                    for (var i = 0; i < data.length; i++) {
                        props[data[i].property] = data[i].value;
                    }

                    $('#check-calc-coeff').attr('checked', props.calc_coeff == 'true');
                    $('#input-extreme-lambda').val(props.deviation_extreme_lambda);
                    $('#input-major-lambda').val(props.deviation_major_lambda);
                    $('#input-significant-lambda').val(props.deviation_significant_lambda);
                    $('#input-minor-lambda').val(props.deviation_minor_lambda);
                    $('#btn-fric-cancel, #btn-fric-ok').attr('disabled', 'disabled');

                    $('#check-calc-coeff').change();
                },
                error: handleAjaxError()
            });
        }

        $('#check-calc-coeff').change(function () {
            var isChecked = $(this).is(':checked');
            if (isChecked) {
                // fetch the configuration from the db
                calcCoeffDiv.removeClass('hidden');
            }
            else
                calcCoeffDiv.addClass('hidden');
        });

        $('#config-done').click(function () {
            $.ajax('api/config', {
                method: 'POST',
                data: {
                    calc_coeff: $('#check-calc-coeff').is(':checked'),
                    deviation_extreme_lambda: $('#input-extreme-lambda').val(),
                    deviation_major_lambda: $('#input-major-lambda').val(),
                    deviation_minor_lambda: $('#input-significant-lambda').val(),
                    deviation_significant_lambda: $('#input-minor-lambda').val()
                },
                error: handleAjaxError()
            });
        });

        $('#config-cancel').click(function () {
            fetchConfig();
        });

        $('#config-cancel, #config-done').click(function () {
            $('#popup-config').modal('hide');
        });

        $('#lnk-config').click(function (event) {
            event.preventDefault();
            $('#popup-config').modal({ show: true });
        });
    })();

    //========================================================
    // INITIALIZE NAVIGATION
    //========================================================

    $('.nav-pills a').click(function () {
        $('#div-model-details').addClass('hidden');
        $('#table-models-offline,#table-models-public,#table-models-active,#table-models-inactive').find('.success').removeClass('success');
    });

    $('.nav-pills a')[0].click();
})();
