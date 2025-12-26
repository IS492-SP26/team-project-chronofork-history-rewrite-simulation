# logger.py
import csv
import json
import datetime
import os
from typing import Any

class EventLogger:
    def __init__(self,):
        if not os.path.exists('logs'):
            os.makedirs('logs')
            
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = f'logs/session_{timestamp}.tsv'
        
        # 初始化表头
        with open(self.log_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f, delimiter='\t')
            # Timestamp: 时间
            # Component: 来源组件 (CastEngine, StoryEngine, Agent...)
            # Event: 事件类型 (FunctionCall, LLM_Input, LLM_Output, StateChange...)
            # Summary: 人类可读简述
            # Payload: 机器完整数据 (JSON)
            writer.writerow(['Timestamp', 'Component', 'Event', 'Summary', 'Payload'])

    def log(self, component: str, event: str, summary: str, payload: Any = None):
        """
        记录日志
        """
        now = datetime.datetime.now().strftime("%H:%M:%S")
        
        # 处理 payload 序列化
        payload_str = ""
        if payload is not None:
            try:
                # default=str 处理无法序列化的对象
                payload_str = json.dumps(payload, ensure_ascii=False, default=str)
            except:
                payload_str = str(payload)

        with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f, delimiter='\t')
            writer.writerow([now, component, event, summary, payload_str])
            
    def get_log_path(self):
        return self.log_file