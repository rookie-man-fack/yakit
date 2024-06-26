import React, {useEffect, useState} from "react"
import {showModal} from "../../utils/showModal"
import {Button, Form} from "antd"
import {failed, info} from "../../utils/notification"
import {InputItem, SelectOne} from "../../utils/inputUtil"
import {StringToUint8Array} from "@/utils/str"
import {getRemoteValue, setRemoteValue} from "@/utils/kv"
import {CacheDropDownGV} from "@/yakitGV"
import {YakitButton} from "@/components/yakitUI/YakitButton/YakitButton"
import {YakitRadioButtons} from "@/components/yakitUI/YakitRadioButtons/YakitRadioButtons"
import {YakitFormDragger} from "@/components/yakitUI/YakitForm/YakitForm"
import {showYakitModal} from "@/components/yakitUI/YakitModal/YakitModalConfirm"

interface InsertFileFuzzTagProp {
    onFinished: (i: string) => any
    defaultMode?: ModeProps
}

type ModeProps = "file" | "file:line" | "file:dir"

const INSERT_FILE_FUZZ_TAG = "insert-file-fuzz-tag"

const InsertFileFuzzTag: React.FC<InsertFileFuzzTagProp> = (props) => {
    const {defaultMode} = props
    const [filename, setFilename] = useState("")
    const [mode, setMode] = useState<ModeProps>(defaultMode || "file")
    const [autoComplete, setAutoComplete] = useState<string[]>([])

    useEffect(() => {
        // 缓存数据结构迁移(后续删除)
        getRemoteValue(INSERT_FILE_FUZZ_TAG).then((data) => {
            if (!data) return
            const {fileNameHistory} = JSON.parse(data)
            setAutoComplete(fileNameHistory)

            setRemoteValue(
                CacheDropDownGV.WebFuzzerInsertFileFuzzTag,
                JSON.stringify({defaultValue: "", options: fileNameHistory})
            )
        })
    }, [])

    // 数组去重
    const filter = (arr) => arr.filter((item, index) => arr.indexOf(item) === index)

    return (
        <Form
            labelCol={{span: 5}}
            wrapperCol={{span: 14}}
            style={{marginTop: 15}}
            onSubmitCapture={(e) => {
                e.preventDefault()
                if (!filename) {
                    info("选中的文件名为空")
                    return
                }
                
                const index = filename.lastIndexOf(".")
                if (mode !== "file:dir") {
                    if (index === -1) {
                        failed("请输入正确的路径")
                        return
                    }
                } else {
                    if (index !== -1) {
                        failed("请输入正确的路径")
                        return
                    }
                }

                getRemoteValue(INSERT_FILE_FUZZ_TAG).then((data) => {
                    if (!data) {
                        setRemoteValue(
                            INSERT_FILE_FUZZ_TAG,
                            JSON.stringify({
                                fileNameHistory: [filename]
                            })
                        )
                        setRemoteValue(
                            CacheDropDownGV.WebFuzzerInsertFileFuzzTag,
                            JSON.stringify({defaultValue: "", options: [filename]})
                        )
                        return
                    }
                    const {fileNameHistory} = JSON.parse(data)
                    const newFileNameHistory = filter([filename, ...fileNameHistory]).slice(0, 10)
                    setRemoteValue(
                        INSERT_FILE_FUZZ_TAG,
                        JSON.stringify({
                            fileNameHistory: newFileNameHistory
                        })
                    )
                    setRemoteValue(
                        CacheDropDownGV.WebFuzzerInsertFileFuzzTag,
                        JSON.stringify({defaultValue: "", options: newFileNameHistory})
                    )
                })

                switch (mode) {
                    case "file":
                        props.onFinished(`{{file(${filename})}}`)
                        return
                    case "file:line":
                        props.onFinished(`{{file:line(${filename})}}`)
                        return
                    case "file:dir":
                        props.onFinished(`{{file:dir(${filename})}}`)
                        return
                }
            }}
        >
            <Form.Item label={<></>} colon={false}>
                <YakitRadioButtons
                    buttonStyle='solid'
                    options={[
                        {
                            value: "file",
                            label: "文件内容"
                        },
                        {
                            value: "file:line",
                            label: "按行读取文件"
                        },
                        {
                            value: "file:dir",
                            label: "文件夹内所有"
                        }
                    ]}
                    value={mode}
                    onChange={(e) => {
                        setMode(e.target.value)
                    }}
                />
            </Form.Item>
            <YakitFormDragger
                formItemProps={{
                    name: "filename",
                    label: "选择路径",
                    labelCol: {span: 5},
                    wrapperCol: {span: 14}
                }}
                selectType={mode !== "file:dir" ? "file" : "folder"}
                isShowPathNumber={false}
                multiple={false}
                showFailedFlag={false}
                renderType='autoComplete'
                onChange={(val) => {
                    setFilename(val)
                }}
                value={filename}
                autoCompleteProps={{
                    options: autoComplete.map((i) => {
                        return {value: i, label: i}
                    })
                }}
            />
            <Form.Item label={<></>} colon={false}>
                <YakitButton type='primary' htmlType='submit' size={"large"}>
                    确定所选内容
                </YakitButton>
            </Form.Item>
        </Form>
    )
}

const {ipcRenderer} = window.require("electron")

const InsertTextToFuzzTag: React.FC<InsertFileFuzzTagProp> = (props) => {
    const [content, setContent] = useState("")
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<"file" | "file:line" | "file:dir">("file:line")
    return (
        <Form
            labelCol={{span: 5}}
            wrapperCol={{span: 14}}
            onSubmitCapture={(e) => {
                e.preventDefault()

                ipcRenderer
                    .invoke("SaveTextToTemporalFile", {Text: StringToUint8Array(content)})
                    .then((rsp: {FileName: string}) => {
                        info("生成临时字典文件:" + rsp.FileName)
                        const filename = rsp.FileName
                        switch (mode) {
                            case "file":
                                props.onFinished(`{{file(${filename})}}`)
                                return
                            case "file:line":
                                props.onFinished(`{{file:line(${filename})}}`)
                                return
                        }
                    })
                    .catch((e) => {
                        failed(`生成临时字典失败:${e}`)
                    })
            }}
        >
            <InputItem label={"文本"} textarea={true} textareaRow={8} value={content} setValue={setContent} />
            <SelectOne
                label={" "}
                colon={false}
                data={[
                    {value: "file", text: "文件内容"},
                    {value: "file:line", text: "按行读取文件"}
                ]}
                value={mode}
                setValue={setMode}
            />
            {/*<InputItem label={"临时文件路径"} value={filename} setValue={setFilename} disable={true}/>*/}
            <Form.Item colon={false} label={" "}>
                <Button type='primary' htmlType='submit'>
                    {" "}
                    确定插入标签{" "}
                </Button>
            </Form.Item>
        </Form>
    )
}

export const insertFileFuzzTag = (onInsert: (i: string) => any, defaultMode?: ModeProps) => {
    let m = showYakitModal({
        title: "选择文件并插入",
        width: "800px",
        content: (
            <>
                <InsertFileFuzzTag
                    defaultMode={defaultMode}
                    onFinished={(e) => {
                        onInsert(e)
                        m.destroy()
                    }}
                />
            </>
        ),
        footer: null
    })
}

export const insertTemporaryFileFuzzTag = (onInsert: (i: string) => any) => {
    let m = showModal({
        title: "复制你想要作为字典的文本",
        width: "800px",
        content: (
            <>
                <InsertTextToFuzzTag
                    onFinished={(e) => {
                        onInsert(e)
                        m.destroy()
                    }}
                />
            </>
        )
    })
}
