import React, { useState, useEffect, Fragment } from 'react';
import { useLocation, useNavigate } from "react-router";
import { Helmet } from "react-helmet";
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { message, Input, InputNumber, Form, Switch, Button, Spin, Select, Divider } from 'antd';
import { SaveOutlined, PlusOutlined, MinusCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import handleErrorContent from '@/utils/handleErrorContent';
import configService from '@/services/config';

const Config = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState({});
  const [serverPlatform, setServerPlatform] = useState('');
  const [serverArch, setServerArch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await configService.get();
      if (res) {
        setInitialValues({
          ...res.config,
          basePaths: res.config?.basePaths ?
            Object.entries(res.config.basePaths).map(([key, val]) => ({
              name: key,
              path: val
            })) :
            []
        });
        setServerPlatform(res.platform);
        setServerArch(res.arch);
      }
    } catch (e) {
      console.log(e);
      messageApi.error(`Failed to fetch config data: ${handleErrorContent(e)}`);
    }
    setLoading(false);
  }

  const handleFormOnFinish = async (values) => {
    setLoading(true);
    try {
      let basePaths = {};
      for (const basePath of values.basePaths) {
        basePaths[basePath.name] = basePath.path;
      }
      await configService.set({
        ...values,
        basePaths
      });
      const res = await configService.get();
      if (res) {
        setInitialValues(res.config);
        setServerPlatform(res.platform);
        setServerArch(res.arch);
      }
    } catch (e) {
      console.log(e);
      messageApi.error(`Failed to save config data: ${handleErrorContent(e)}`);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [location.pathname]);

  return (
    <PageContainer
      title="Config"
      breadcrumb={{}}
      onBack={() => navigate(-1)}
    >
      <Helmet>
        <title>Config - File Browser</title>
      </Helmet>
      {contextHolder}
      <ProCard>
        <Spin spinning={loading}>
          <Form
            key={loading}
            onFinish={handleFormOnFinish}
            initialValues={initialValues}
            labelCol={{ xxl: 6, xl: 8, lg: 8, md: 10, sm: 12, xs: 24 }}
            wrapperCol={{ xxl: 8, xl: 12, lg: 14, md: 12, sm: 12, xs: 24 }}
            form={form}
          >
            <Divider orientation="left"><h4>General</h4></Divider>
            <Form.List
              name="basePaths"
            >
              {(fields, { add, move, remove }, { errors }) => (
                <Fragment>
                  {fields.map((field, index) => (
                    <Form.Item
                      key={field.key}
                      label={index === 0 ? "Directories" : " "}
                      colon={index === 0 ? true : false}
                      style={{ marginBottom: '0' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          marginBottom: '8px',
                          gap: '8px',
                          alignItems: 'baseline'
                        }}
                      >
                        <Form.Item
                          // label="Name"
                          name={[field.name, 'name']}
                          style={{ marginBottom: '16px' }}
                        >
                          <Input
                            placeholder="Name"
                          />
                        </Form.Item>
                        <Form.Item
                          // label="Path"
                          name={[field.name, 'path']}
                          style={{ marginBottom: '16px', flexGrow: '1' }}
                        >
                          <Input
                            placeholder="Path"
                          />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(field.name)} />
                      </div>
                    </Form.Item>
                  ))}
                  <Form.Item
                    label=" "
                    colon={false}
                  >
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block={true}
                      icon={<PlusOutlined />}
                    >
                      Add directory
                    </Button>
                  </Form.Item>
                </Fragment>
                )}
            </Form.List>
            <Form.Item
              label="SQLite DB file path"
              name="dbPath"
            >
              <Input
                placeholder="C:\FileBrowserServer\server\db\db.sqlite"
              />
            </Form.Item>
            <Form.Item
              label="Temp file directory"
              name="tempDir"
            >
              <Input
                placeholder="C:\FileBrowserServer\cache"
              />
            </Form.Item>
            <Form.Item
              label="Smart Monitor Tools executable file path"
              name="smartctlPath"
            >
              <Input
                placeholder="C:\Program Files\smartmontools\bin\smartctl.exe"
              />
            </Form.Item>
            <Form.Item
              label="FFmpeg executable path"
              name="ffmpegPath"
            >
              <Input
                placeholder="C:\ffmpeg-7.1-full_build-shared\bin\ffmpeg.exe"
              />
            </Form.Item>
            <Form.Item
              label="Enable folder size calculation"
              name="enableDirSizeChk"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Divider orientation="left"><h4>Archive</h4></Divider>
            <Form.Item
              label="7-zip executable file path"
              name="sevenZipPath"
            >
              <Input
                placeholder="C:\Program Files\7-Zip\7z.exe"
              />
            </Form.Item>
            <Form.Item
              label="WinRAR executable file path"
              name="winRarPath"
              tooltip="Not supported on ARM based linux"
            >
              <Input
                placeholder="C:\Program Files\WinRAR\Rar.exe"
                disabled={serverPlatform === 'linux' && serverArch !== 'x64'}
              />
            </Form.Item>
            <Form.Item
              label="WinRAR language"
              name="winRarLang"
              tooltip="Only supports listed languages"
            >
              <Select
                disabled={serverPlatform === 'linux' && serverArch !== 'x64'}
                options={[{
                  value: 'en-US',
                  label: 'English'
                }, {
                  value: 'zh-CN',
                  label: 'Chinese Simplified'
                }]}
              />
            </Form.Item>
            <Divider orientation="left"><h4>Thumbnail</h4></Divider>
            <Form.Item
              label="Preview thumbnail cache path"
              name="previewCachePath"
            >
              <Input
                placeholder="C:\FileBrowserServer\cache"
              />
            </Form.Item>
            <Form.Item
              label="Preview thumbnail image width"
              name="previewImageMaxWidth"
            >
              <InputNumber
                placeholder={512}
              />
            </Form.Item>
            <Form.Item
              label="Preview thumbnail image height"
              name="previewImageMaxHeight"
            >
              <InputNumber
                placeholder={512}
              />
            </Form.Item>
            <Divider orientation="left"><h4>Video</h4></Divider>
            <Form.Item
              label="Video transcode FPS"
              name="playVideoFps"
            >
              <InputNumber
                placeholder={24}
              />
            </Form.Item>
            <Form.Item
              label="Enable hardware acceleration"
              name="enablePlayVideoHardwareAcceleration"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item noStyle dependencies={['enablePlayVideoHardwareAcceleration']}>
              {() => (
                <Fragment>
                  <Form.Item
                    label="Hardware vendor"
                    name="playVideoHardwareAccelerationVendor"

                  >
                    <Select
                      disabled={!form.getFieldValue('enablePlayVideoHardwareAcceleration')}
                      options={[{
                        value: 'intel',
                        label: 'Intel'
                      }, {
                        value: 'nvidia',
                        label: 'Nvidia'
                      }]}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Acceleration device"
                    name="playVideoHardwareAccelerationDevice"
                    tooltip="It's better to leave it empty if you don't know what this is."
                  >
                    <Input
                      disabled={!form.getFieldValue('enablePlayVideoHardwareAcceleration')}
                      placeholder="E.g. '0', '1'. Or leave it empty"
                    />
                  </Form.Item>
                </Fragment>
              )}
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

export default Config;