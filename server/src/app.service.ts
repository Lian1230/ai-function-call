import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

async function getCurrentWeather({ lat, lon }: { lat: string; lon: string }) {
  const url = `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
  const res = await fetch(url);
  const weatherInfo = await res.json();

  return JSON.stringify(weatherInfo);
}

const functions = [
  {
    name: 'get_current_weather',
    description: 'Get the current weather in a given location',
    parameters: {
      type: 'object',
      properties: {
        lat: {
          type: 'string',
          description: 'The latitude of the location, e.g. 26.074508',
        },
        lon: {
          type: 'string',
          description: 'The longitude of the location, e.g. 119.296494',
        },
      },
      required: ['lat', 'lon'],
    },
  },
  {
    name: 'get_todo_list',
    description: 'Get the current todo list',
    parameters: {
      type: 'object',
      properties: {
        person: {
          type: 'string',
          description: 'The name of the person whose todo list to get',
        },
      },
      required: ['person'],
    },
  },
  {
    name: 'create_todo',
    description: 'Create a new todo item',
    parameters: {
      type: 'object',
      properties: {
        person: {
          type: 'string',
          description: 'The name of the person whose todo list in which to add',
        },
        name: {
          type: 'string',
          description: 'The name of the todo item',
        },
        completed: {
          type: 'boolean',
          description: 'Whether the todo item is completed',
        },
      },
      required: ['person', 'name'],
    },
  },
];

const SYSTEM_PROMPTS = [
  {
    role: 'system' as ChatCompletionMessageParam['role'],
    content:
      '如果你决定要执行一个function，但是该function需要一些必要参数，注意不要编造参数!!!请从聊天记录中寻找或者立刻询问用户',
  },
];

@Injectable()
export class AppService {
  todoList = {
    lian: [
      {
        name: '学习openAI',
        completed: false,
      },
    ],
  };

  getTodoList({ person }: { person: string }) {
    const name = person.toLocaleLowerCase();
    if (!this.todoList[name]) {
      if (name === '我') {
        return JSON.stringify({
          error: 'Invalid person name, please ask user their name',
        });
      }
      return JSON.stringify({
        error: 'No todo list found, you can ask user to create one',
      });
    }
    return JSON.stringify(this.todoList[person.toLocaleLowerCase()]);
  }

  createTodo({
    person,
    name,
    completed = false,
  }: {
    person: string;
    name: string;
    completed: boolean;
  }) {
    const personName = person.toLocaleLowerCase();
    if (!this.todoList[personName]) {
      this.todoList[personName] = [{ name, completed }];
      return JSON.stringify({ message: 'a new todo list created' });
    }
    this.todoList[personName].push({ name, completed });
    return JSON.stringify({ message: 'a new todo item created' });
  }

  availableFunctions: Record<string, (args: any) => Promise<string>> = {
    get_current_weather: getCurrentWeather,
    get_todo_list: this.getTodoList.bind(this),
    create_todo: this.createTodo.bind(this),
  };

  async chat({
    messages,
    key,
  }: {
    messages: Array<ChatCompletionMessageParam>;
    key?: string;
  }): Promise<string> {
    const openai = new OpenAI({
      apiKey: key || process.env.OPENAI_API_KEY,
    });
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: SYSTEM_PROMPTS.concat(messages),
      functions,
      function_call: 'auto',
    });
    const responseMessage = response.choices[0].message;

    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionToCall = this.availableFunctions[functionName];
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);
      console.log('functionCall', responseMessage.function_call, functionArgs);

      const functionResponse = await functionToCall(functionArgs);

      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages.concat([
          responseMessage,
          {
            role: 'function',
            name: functionName,
            content: functionResponse,
          },
        ]),
      });

      return secondResponse.choices[0].message.content;
    }

    return responseMessage.content;
  }
}
