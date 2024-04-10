import React from "react"
import {YakitSystem} from "@/yakitGVDefine"

export interface LocalEngineProps {
    ref?: React.ForwardedRef<LocalEngineLinkFuncProps>
    system: YakitSystem
    setLog: (log: string[]) => any
    onLinkEngine: (port: number) => any
    setYakitStatus: (v: YakitStatusType) => any
}

export interface LocalEngineLinkFuncProps {
    /** 初始化并检查所有前置项后的本地连接 */
    init: () => any
    /** 检查引擎版本后的本地连接 */
    link: () => any
}
