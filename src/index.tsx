import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  useMutation,
} from "@apollo/client";
import type { DocumentNode, InputValueDefinitionNode, TypeNode } from "graphql";
import gql from "graphql-tag";
import startCase from "lodash.startcase";
import { useMemo } from "react";
import { render } from "react-dom";

interface Props {
  action?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  mutation: DocumentNode;
  operation: DocumentNode;
}

function useValidMutationField(mutation: DocumentNode) {
  const field = useMemo(() => {
    // type Mutation { ... } 1個だけ
    if (mutation.definitions.length !== 1) {
      return null;
    }

    const [first] = mutation.definitions;

    // type Mutation { ... } じゃないとダメ
    if (first?.kind !== "ObjectTypeDefinition") {
      return null;
    }

    if (first.name.value !== "Mutation") {
      return null;
    }

    // type Mutation { ... } の中身を 2 つ以上書いてはダメ
    if (first.fields?.length !== 1) {
      return null;
    }

    return first.fields[0];
  }, [mutation]);

  return field;
}

function MutationForm({
  action = "/graphql", // REVIEW: useApolloClient すれば取れる？
  method = "POST",
  mutation,
  operation,
}: Props) {
  const field = useValidMutationField(mutation);
  const [mutate] = useMutation(operation);

  if (!field) {
    return (
      <div>
        ⚠ <code>props.mutation</code> must have exactly one mutation
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      // TODO: field.arguments からなんとかして得たい
    });
  };

  console.log(field.arguments);

  return (
    <form onSubmit={onSubmit} action={action} method={method}>
      <h2>{startCase(field.name.value)}</h2>
      {field.description && <p>{field.description.value}</p>}

      <hr />

      {field.arguments?.map((argument) => (
        <FormField key={argument.name.value} argument={argument} />
      ))}

      <hr />

      <input type="submit" value="Submit" />

      <hr />

      <p>※ This form is auto-generated from the following</p>
      <pre>{mutation.loc?.source.body}</pre>
    </form>
  );
}

function resolveType(type: TypeNode): string {
  switch (type.kind) {
    case "ListType": {
      return `[${resolveType(type.type)}]`;
    }

    case "NamedType": {
      return type.name.value;
    }

    case "NonNullType": {
      return resolveType(type.type) + "!";
    }
  }
}

function FormField({ argument }: { argument: InputValueDefinitionNode }) {
  const htmlFor = argument.name.value;

  const placeholder = useMemo(() => resolveType(argument.type), [argument]);

  // FIXME: 雑
  const type =
    placeholder === "Int"
      ? "number"
      : placeholder === "ISO8601DateTime"
      ? "datetime-local"
      : "text";

  return (
    <div>
      <label htmlFor={htmlFor}>
        <h4>
          {startCase(argument.name.value)}
          {argument.description && (
            <small> - {argument.description.value}</small>
          )}
        </h4>
      </label>
      <input
        id={htmlFor}
        type={type}
        name={argument.name.value}
        placeholder={placeholder}
      />
    </div>
  );
}

function App() {
  const mutation = gql`
    type Mutation {
      """
      本を1件登録します
      """
      registerBook(
        id: ID

        """
        本のタイトル
        """
        name: String!

        """
        ページ数（省略可）
        """
        pageCount: Int
      ): Book
    }
  `;

  const operation = gql`
    mutation OnSubmit($id: ID, $name: String!, $pageCount: Int) {
      registerBook(id: $id, name: $name, pageCount: $pageCount) {
        id
      }
    }
  `;

  return (
    <main>
      <MutationForm mutation={mutation} operation={operation} />
    </main>
  );
}

render(
  <ApolloProvider
    client={
      new ApolloClient({
        uri: "/graphql",
        cache: new InMemoryCache(),
      })
    }
  >
    <App />
  </ApolloProvider>,
  document.getElementById("app")
);
