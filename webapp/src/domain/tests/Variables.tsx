import React, { useState, useRef, useEffect, MutableRefObject } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { isTesterSelector } from '../../auth'
import { alertAction } from '../../alerts'
import * as api from '../alerting/api'
import { Variable } from '../alerting/types'

import {
    Bullseye,
    Button,
    Form,
    ActionGroup,
    FormGroup,
    TextInput,
} from '@patternfly/react-core';

import {
    OutlinedTimesCircleIcon
} from '@patternfly/react-icons';

import Accessors from '../../components/Accessors'
import Editor, { ValueGetter } from '../../components/Editor/monaco/Editor'

type VariablesProps = {
    testId: number
    saveHookRef: MutableRefObject<(() => void) | undefined>
}

export default ({ testId, saveHookRef }: VariablesProps) => {
    const [variables, setVariables] = useState<Variable[] | undefined>()
    const calculations = new Array<ValueGetter | undefined>()
    const dispatch = useDispatch()
    useEffect(() => {
        api.variables(testId).then(
            response => {
                setVariables(response)
                calculations.splice(0)
                variables?.forEach(_ => calculations.push(undefined));
            },
            error => dispatch(alertAction("VARIABLE_FETCH", "Failed to fetch regression variables", error))
        )
    }, [testId])
    const isTester = useSelector(isTesterSelector)
    saveHookRef.current = () => {
        if (variables) {
            api.updateVariables(testId, variables).catch(
                error => dispatch(alertAction("VARIABLE_UPDATE", "Failer to update regression variables", error))
            )
        }
    }

    return (<>
        { !variables && <Bullseye />}
        { variables?.map((v, i) => (
            <div style={{ display: "flex "}}>
               <Form isHorizontal={true} style={{ gridGap: "2px", width: "100%", float: "left", marginBottom: "25px" }}>
                   <FormGroup label="Name" fieldId="name">
                     <TextInput value={ v.name || "" }
                                id="namer"
                                onChange={ value => {
                                    v.name = value
                                    setVariables([ ...variables])
                                }}
                                isValid={ !!v.name && v.name.trim() !== "" }
                                isReadOnly={!isTester} />
                   </FormGroup>
                   <FormGroup label="Accessors" fieldId="accessor">
                     <Accessors
                                value={ (v.accessors && v.accessors.split(/[,;] */).map(a => a.trim()).filter(a => a.length !== 0)) || [] }
                                onChange={ value => { v.accessors = value.join(";"); }}
                                isReadOnly={!isTester} />
                   </FormGroup>
                   <FormGroup label="Calculation" fieldId="calculation">
                     <div style={{ minHeight: "100px", height: "100px", resize: "vertical", overflow: "auto" }}>
                         <Editor value={ (v.calculation && v.calculation.toString()) || "" }
                                 setValueGetter={e => { calculations[i] = e }}
                                 options={{ wordWrap: 'on', wrappingIndent: 'DeepIndent', language: 'typescript', readOnly: !isTester }} />
                     </div>
                   </FormGroup>
               </Form>
               { isTester &&
               <div style={{ width: "40px", float: "right", display: "table-cell", position: "relative", marginBottom: "25px" }}>
                   <Button style={{width: "100%", position: "absolute", left: "0px", top: "38%"}}
                           variant="plain"
                           onClick={ () => {
                              variables.splice(i, 1)
                              calculations.splice(i, 1)
                              setVariables([ ...variables ])
                   }}><OutlinedTimesCircleIcon style={{color: "#a30000"}}/></Button>
               </div>
               }
            </div>
        ))}
        { isTester &&
        <ActionGroup>
            <Button onClick={ () => {
               variables?.push({
                   id: -1,
                   testid: testId,
                   name: "",
                   accessors: "",
               })
               calculations.push(undefined)
               setVariables([ ...variables])
            }} >Add variable</Button>

        </ActionGroup>
        }
    </>)
}