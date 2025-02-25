/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import React, { useState }  from 'react';
import { Alert, Glyphicon } from 'react-bootstrap';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';

import {
    editStyleCode,
    errorStyle,
    updateEditorMetadata
} from '../../actions/styleeditor';
import { updateNode } from '../../actions/layers';
import SLDService from '../../api/SLDService';
import {
    classificationRaster,
    classificationVector
} from '../../api/StyleEditor';
import Message from '../../components/I18N/Message';
import BorderLayout from '../../components/layout/BorderLayout';
import Loader from '../../components/misc/Loader';
import Toolbar from '../../components/misc/toolbar/Toolbar';
import TextareaEditor from '../../components/styleeditor/Editor';
import VisualStyleEditor from '../../components/styleeditor/VisualStyleEditor';
import {
    mapSelector,
    scalesSelector
} from '../../selectors/map';
import {
    canEditStyleSelector,
    codeStyleSelector,
    editorMetadataSelector,
    errorStyleSelector,
    formatStyleSelector,
    geometryTypeSelector,
    getUpdatedLayer,
    layerPropertiesSelector,
    loadingStyleSelector,
    styleServiceSelector
} from '../../selectors/styleeditor';
import { createShallowSelector } from '../../utils/ReselectUtils';
import {
    getEditorMode,
    getAttributes
} from '../../utils/StyleEditorUtils';
import inlineWidgets from './inlineWidgets';

const styleUpdateTypes = {
    'classificationVector': classificationVector,
    'classificationRaster': classificationRaster,
    // support previous type
    'classification': classificationVector,
    'classification-raster': classificationRaster
};

function getAttributesFromHintProperties(hintProperties, geometryType, fields) {
    return hintProperties && geometryType !== 'raster'
        ? getAttributes(hintProperties, fields)
        : [];
}

const ConnectedVisualStyleEditor = connect(
    createSelector(
        [
            codeStyleSelector,
            formatStyleSelector,
            layerPropertiesSelector,
            errorStyleSelector,
            loadingStyleSelector,
            getUpdatedLayer,
            geometryTypeSelector,
            scalesSelector,
            mapSelector,
            styleServiceSelector
        ],
        (code, format, hintProperties, error, loading, layer, geometryType, scales, map, styleService) => ({
            code,
            mode: getEditorMode(format),
            bands: isArray(hintProperties) && geometryType === 'raster' && hintProperties || [],
            attributes: getAttributesFromHintProperties(hintProperties, geometryType, layer?.fields),
            error: error.edit || null,
            loading,
            format,
            layer,
            geometryType,
            scales: scales.map(scale => Math.round(scale)),
            zoom: map.zoom,
            fonts: styleService.fonts || [],
            methods: (geometryType === 'raster'
                ? styleService?.classificationMethods?.raster
                : styleService?.classificationMethods?.vector) || SLDService.methods,
            styleService: { baseUrl: styleService?.baseUrl, isStatic: styleService?.isStatic }
        })
    ),
    {
        onError: errorStyle.bind(null, 'edit')
    }
)(VisualStyleEditor);

ConnectedVisualStyleEditor.defaultProps = {
    getColors: SLDService.getColors,
    styleUpdateTypes
};

const ConnectedTextareaEditor = connect(createSelector(
    [
        codeStyleSelector,
        formatStyleSelector,
        layerPropertiesSelector,
        errorStyleSelector,
        loadingStyleSelector
    ],
    (code, format, hintProperties, error, loading) => ({
        code,
        mode: getEditorMode(format),
        hintProperties,
        error: error.edit || null,
        loading
    })
))(TextareaEditor);

const editors = {
    visual: ConnectedVisualStyleEditor,
    textarea: ConnectedTextareaEditor
};

export function StyleEditor({
    code,
    error,
    canEdit,
    editorType,
    onUpdateMetadata,
    onChange,
    loading,
    header,
    editors: editorsProp = [],
    ...props
}) {
    const [alert, setAlert] = useState();

    const centeredChildStyle = {
        position: 'relative',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center'
    };

    if (!code && !error) {
        // loading
        return (
            <div style={centeredChildStyle}>
                <Loader size={150}/>
            </div>);
    }
    if (!canEdit) {
        // missing permission
        return (
            <div style={centeredChildStyle}>
                <div>
                    <Glyphicon glyph="exclamation-mark" style={{ fontSize: 150 }}/>
                    <h1><Message msgId="styleeditor.noPermission"/></h1>
                </div>
            </div>);
    }
    if (error?.status === 404) {
        // not found
        return (
            <div style={centeredChildStyle}>
                <div>
                    <Glyphicon glyph="exclamation-mark" style={{ fontSize: 150 }}/>
                    <h1><Message msgId="styleeditor.styleNotFound"/></h1>
                </div>
            </div>);
    }

    const EditorComponent = editorsProp[editorType] || editors[editorType] || editors.visual;

    return (
        <BorderLayout
            style={{ position: 'relative' }}
            header={
                <div className="ms-style-editor-toolbar">
                    <div className="ms-style-editor-toolbar-left">
                        {header}
                    </div>
                    <Toolbar
                        buttons={[
                            {
                                className: 'no-border',
                                bsSize: 'xs',
                                disabled: loading,
                                active: editorType === 'visual',
                                textId: editorType === 'textarea'
                                    ? 'styleeditor.switchToVisualEditor'
                                    : 'styleeditor.switchToTextareaEditor',
                                onClick: () => {
                                    if (loading) {
                                        return null;
                                    }
                                    if (editorType === 'visual') {
                                        return onUpdateMetadata({ editorType: 'textarea' });
                                    }
                                    return setAlert(true);
                                }
                            }
                        ]}
                    />
                </div>
            }>
            {EditorComponent && <EditorComponent
                {...props}
                code={code}
                error={error}
                onChange={(newCode, style) => {
                    onChange(newCode);
                    if (isObject(style)) {
                        onUpdateMetadata({ styleJSON: JSON.stringify(style) });
                    }
                }}
            />}
            {alert &&
            <div
                className="ms-style-editor-alert"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)'
                }}>
                <Alert bsStyle="warning" style={{ textAlign: 'center' }}>
                    <p style={{ padding: 8 }}><Message msgId="styleeditor.alertForceTranslate" /></p>
                    <p>
                        <Toolbar
                            buttons={[
                                {
                                    text: <Message msgId="styleeditor.stayInTextareaEditor" />,
                                    onClick: () => setAlert(false),
                                    style: { marginRight: 4 }
                                },
                                {
                                    bsStyle: 'primary',
                                    text: <Message msgId="styleeditor.useLatestValidStyle" />,
                                    onClick: () => {
                                        onUpdateMetadata({ editorType: 'visual' });
                                        setAlert(false);
                                    }
                                }
                            ]}
                        />
                    </p>
                </Alert>
            </div>}
        </BorderLayout>
    );
}

StyleEditor.defaultProps = {
    inlineWidgets
};

const editorTypeSelector = state => {
    const metadata = editorMetadataSelector(state);
    return metadata?.editorType;
};

const defaultStyleJSONSelector = state => {
    try {
        const metadata = editorMetadataSelector(state);
        return JSON.parse(metadata?.styleJSON);
    } catch (e) {
        return null;
    }
};

const StyleCodeEditor = connect(
    createShallowSelector(
        codeStyleSelector,
        errorStyleSelector,
        canEditStyleSelector,
        editorTypeSelector,
        defaultStyleJSONSelector,
        loadingStyleSelector,
        (code, error, canEdit, editorType, defaultStyleJSON, loading) => ({
            code,
            error: error.edit || null,
            canEdit,
            editorType,
            defaultStyleJSON,
            loading
        })
    ),
    {
        onUpdateMetadata: updateEditorMetadata,
        onChange: editStyleCode,
        onUpdateNode: updateNode
    }
)(StyleEditor);

export default StyleCodeEditor;
