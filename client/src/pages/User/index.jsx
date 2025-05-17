import React, { useState } from 'react';
import { useNavigate, useOutletContext } from "react-router";
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { message, Input, Form, Button, Spin } from 'antd';
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import handleErrorContent from '@/utils/handleErrorContent';
import userService from '@/services/user';

const User = () => {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [user, setUser] = useOutletContext();

  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);

  const handleFormOnFinish = async (values) => {
    setLoading(true);
    try {
      const res = await userService.setUserInfo(values);
      if (res) {
        setUser((prev) => {
          return {
            ...prev,
            ...res
          };
        });
      }
    } catch (e) {
      console.log(e);
      messageApi.error(`Failed to save user info: ${handleErrorContent(e)}`);
    }
    setLoading(false);
  }

  return (
    <PageContainer
      title="Edit User Info"
      breadcrumb={{}}
      onBack={() => navigate(-1)}
    >
      {contextHolder}
      <ProCard>
        <Spin spinning={loading}>
          <Form
            key={loading}
            onFinish={handleFormOnFinish}
            initialValues={user}
            labelCol={{ xxl: 4, xl: 5, lg: 6, md: 8, sm: 8, xs: 24 }}
            wrapperCol={{ xxl: 4, xl: 6, lg: 8, md: 10, sm: 12, xs: 24 }}
            form={form}
          >
            <Form.Item
              label="User name"
              name="username"
              rules={[{
                required: true
              }, {
                max: 16
              }, {
                min: 4
              }]}
            >
              <Input
                placeholder="Input your username"
              />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{
                min: 4
              }, {
                max: 16
              }]}
            >
              <Input.Password
                placeholder="Input your password"
              />
            </Form.Item>
            <Form.Item
              label="Repeat password"
              name="confirm"
              dependencies={['password']}
              rules={[{
                min: 4
              }, {
                max: 16
              }, ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The new password that you entered do not match!'));
                },
              })]}
            >
              <Input.Password
                placeholder="Repeat your password"
              />
            </Form.Item>
            <Form.Item
              label=" "
              colon={false}
            >
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
              >
                Save
              </Button>
              <Button
                htmlType="button"
                icon={<RollbackOutlined />}
                onClick={() => form.resetFields()}
                style={{ marginLeft: '8px' }}
              >
                Reset
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </ProCard>
    </PageContainer>
  );
};

export default User;